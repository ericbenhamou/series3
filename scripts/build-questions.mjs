import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const rawPath = path.join(rootDir, "data", "raw-ocr.json");
const jsonPath = path.join(rootDir, "data", "questions.json");
const jsPath = path.join(rootDir, "data", "questions.js");

if (!fs.existsSync(rawPath)) {
  throw new Error(`Missing OCR source file: ${rawPath}`);
}

const rawEntries = JSON.parse(fs.readFileSync(rawPath, "utf8").replace(/^\uFEFF/, ""));

const choicePattern = /^([A-D])[\.\)]\s*(.*)$/i;
const headerPattern = /^QUESTION ID\s+(\d+)/i;
const correctPattern = /^CORRECT ANSWER IS:\s*(.+)$/i;
const yourPattern = /^YOUR ANSWER IS:\s*(.+)$/i;

const categoryRules = [
  {
    name: "Compliance",
    re: /\b(nfa|cftc|finra|advertis|promotional|registration|registered|associated person|business committee|ethical|disclosure|customer account|broker|fcm|cta|cpo|ib)\b/i,
  },
  {
    name: "Options",
    re: /\b(option|options|put|puts|call|calls|strike price|synthetic)\b/i,
  },
  {
    name: "Currencies",
    re: /\b(sw(?:iss)? francs?|yen|euro|euros|foreign exchange|currency exchange|currency|spot rate|futures are|fx)\b/i,
  },
  {
    name: "Rates & Bonds",
    re: /\b(t[' ]?bill|t[' ]?bond|eurodollar|ted spread|sofr|interest rates?|yield|bond futures|bill contract)\b/i,
  },
  {
    name: "Hedging",
    re: /\b(hedge|hedger|anticipatory hedge|effective purchase|effective sales|offsets? the hedge)\b/i,
  },
  {
    name: "Spreads",
    re: /\b(spread|spreader|crush|processor|inter-commodity|intra-commodity|inter-market)\b/i,
  },
  {
    name: "Delivery & Settlement",
    re: /\b(delivery|deliver|first notice|last trading day|settlement|closing price|clearinghouse|mark(?:ed)? to the market|open trade equity|margin)\b/i,
  },
  {
    name: "Agriculture & Energy",
    re: /\b(soy|corn|wheat|cattle|milk|natural gas|gasoline|rbob|feeder cattle|barrels? of oil|commodity stored)\b/i,
  },
  {
    name: "Macro & Market Theory",
    re: /\b(frb|cpi|inflation|exports|imports|supply|demand|contango|basis|overbought|credit risk|market sentiment|substitute commodities)\b/i,
  },
];

function normalizeLine(line) {
  if (!line) return "";

  let value = line
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  value = value.replace(/^QUESTION ID\s+(\d+)\s*:\s*series/i, "QUESTION ID $1 : Series");
  value = value.replace(/\bseries 3\b/gi, "Series 3");
  value = value.replace(/\bGreenlight\b/g, "GreenLight");
  value = value.replace(/^l\.\s/, "I. ");
  value = value.replace(/^'V\.\s/, "IV. ");
  value = value.replace(/^V\.\s/, "IV. ");
  value = value.replace(/\bIll\b/g, "III");
  value = value.replace(/\blV\b/g, "IV");

  return value;
}

function sliceToPrimaryQuestion(lines) {
  const indices = lines
    .map((line, index) => (headerPattern.test(line) ? index : -1))
    .filter((index) => index >= 0);

  if (indices.length > 1) {
    return lines.slice(indices[0], indices[1]);
  }

  return lines;
}

function joinWrappedLines(lines) {
  return lines.join(" ").replace(/\s+/g, " ").trim();
}

function inferCategory(question) {
  const haystack = [
    question.prompt,
    question.explanation,
    ...question.promptLines,
    ...question.explanationLines,
    ...question.choices.map((choice) => choice.text),
  ].join(" ");

  const rule = categoryRules.find((entry) => entry.re.test(haystack));
  return rule ? rule.name : "General Review";
}

function inferTopicTags(question) {
  const text = `${question.prompt} ${question.explanation}`.toLowerCase();
  const tags = [];

  if (/\bhedge|hedger\b/.test(text)) tags.push("hedging");
  if (/\boption|put|call\b/.test(text)) tags.push("options");
  if (/\bnfa|cftc|finra|advertis|registration\b/.test(text)) tags.push("regulation");
  if (/\bspread|contango|basis\b/.test(text)) tags.push("spreads");
  if (/\bbond|bill|eurodollar|interest\b/.test(text)) tags.push("rates");
  if (/\bcurrency|yen|euro|swiss franc\b/.test(text)) tags.push("currency");

  return tags;
}

function parseEntry(entry) {
  const rawLines = Array.isArray(entry.lines) ? entry.lines.map(normalizeLine).filter(Boolean) : [];
  const lines = sliceToPrimaryQuestion(rawLines);
  const headerLine = lines.find((line) => headerPattern.test(line)) || "";
  const questionId = headerLine.match(headerPattern)?.[1] || String(entry.order);

  const correctIndex = lines.findIndex((line) => correctPattern.test(line));
  const yourIndex = lines.findIndex((line) => yourPattern.test(line));

  const bodyLines = lines.slice(1, correctIndex > 0 ? correctIndex : lines.length);
  const explanationLines = yourIndex >= 0 ? lines.slice(yourIndex + 1) : [];

  const promptLines = [];
  const choices = [];
  let currentChoice = null;

  for (const line of bodyLines) {
    const choiceMatch = line.match(choicePattern);

    if (choiceMatch) {
      if (currentChoice) choices.push(currentChoice);
      currentChoice = {
        label: choiceMatch[1].toUpperCase(),
        text: choiceMatch[2].trim(),
      };
      continue;
    }

    if (currentChoice) {
      currentChoice.text = `${currentChoice.text} ${line}`.replace(/\s+/g, " ").trim();
    } else {
      promptLines.push(line);
    }
  }

  if (currentChoice) choices.push(currentChoice);

  const question = {
    order: entry.order,
    fileName: entry.fileName,
    localImage: entry.localImage,
    questionId,
    title: `Question ${questionId}`,
    examLabel: "Series 3 GreenLight Exam",
    promptLines,
    prompt: promptLines.join("\n"),
    choices,
    correctAnswer: lines[correctIndex]?.match(correctPattern)?.[1]?.trim() || "",
    yourAnswer: lines[yourIndex]?.match(yourPattern)?.[1]?.trim() || "",
    explanationLines,
    explanation: joinWrappedLines(explanationLines),
    ocrText: lines.join("\n"),
  };

  question.isWrong = question.correctAnswer !== question.yourAnswer;
  question.isUnanswered = /\[\[NONE\]\]/i.test(question.yourAnswer) || question.yourAnswer === "";
  question.category = inferCategory(question);
  question.tags = inferTopicTags(question);

  return question;
}

const questions = rawEntries.map(parseEntry);

fs.writeFileSync(jsonPath, `${JSON.stringify(questions, null, 2)}\n`, "utf8");
fs.writeFileSync(jsPath, `window.SERIES3_QUESTIONS = ${JSON.stringify(questions, null, 2)};\n`, "utf8");

console.log(`Built ${questions.length} structured questions.`);
