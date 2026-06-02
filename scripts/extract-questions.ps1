param(
    [string]$SourceDir = "C:\Users\eric.benhamou\Desktop\wrong\Greenlight",
    [string]$RawOutput = "data\raw-ocr.json",
    [string]$ScreenshotDir = "screenshots",
    [string]$FilePattern = "error-*.png"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$workspaceRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$screenshotDirInput = $ScreenshotDir

if (-not [System.IO.Path]::IsPathRooted($RawOutput)) {
    $RawOutput = Join-Path $workspaceRoot $RawOutput
}

if (-not [System.IO.Path]::IsPathRooted($ScreenshotDir)) {
    $ScreenshotDir = Join-Path $workspaceRoot $ScreenshotDir
}

if (-not [System.IO.Path]::IsPathRooted($screenshotDirInput)) {
    $relativeScreenshotDir = $screenshotDirInput.Replace("\", "/")
} else {
    $workspaceUri = [System.Uri]::new(((Resolve-Path $workspaceRoot).Path.TrimEnd("\") + "\"))
    $screenshotUri = [System.Uri]::new(((Resolve-Path $ScreenshotDir).Path.TrimEnd("\") + "\"))
    $relativeScreenshotDir = $workspaceUri.MakeRelativeUri($screenshotUri).ToString().TrimEnd("/")
}

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Storage.FileAccessMode, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrResult, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]

$script:asTaskMethod = [System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object {
        $_.Name -eq "AsTask" -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1
    } |
    Select-Object -First 1

function Await-WinRt {
    param(
        [Parameter(Mandatory = $true)]
        $Operation,

        [Parameter(Mandatory = $true)]
        [Type]$ResultType
    )

    $task = $script:asTaskMethod.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
    $task.Wait(-1) | Out-Null
    return $task.Result
}

function Get-OcrEngine {
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()

    if ($null -eq $engine) {
        $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage(
            [Windows.Globalization.Language]::new("en-US")
        )
    }

    if ($null -eq $engine) {
        throw "Unable to create a Windows OCR engine for this profile."
    }

    return $engine
}

function Get-OcrLines {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ImagePath,

        [Parameter(Mandatory = $true)]
        $Engine
    )

    $file = Await-WinRt ([Windows.Storage.StorageFile]::GetFileFromPathAsync($ImagePath)) ([Windows.Storage.StorageFile])
    $stream = Await-WinRt ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $decoder = Await-WinRt ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap = Await-WinRt ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $result = Await-WinRt ($Engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])

    return @($result.Lines | ForEach-Object { $_.Text })
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $RawOutput) | Out-Null
New-Item -ItemType Directory -Force -Path $ScreenshotDir | Out-Null

$engine = Get-OcrEngine
$files = Get-ChildItem -LiteralPath $SourceDir -Filter $FilePattern | Sort-Object {
    [int](($_.BaseName -replace "[^\d]", ""))
}

if ($files.Count -eq 0) {
    throw "No screenshots were found in '$SourceDir'."
}

$records = foreach ($file in $files) {
    Write-Host ("OCR: {0}" -f $file.Name)

    $targetImage = Join-Path $ScreenshotDir $file.Name
    Copy-Item -LiteralPath $file.FullName -Destination $targetImage -Force

    $lines = Get-OcrLines -ImagePath $file.FullName -Engine $engine

    [PSCustomObject]@{
        order      = [int](($file.BaseName -replace "[^\d]", ""))
        fileName   = $file.Name
        sourcePath = $file.FullName
        localImage = ("{0}/{1}" -f $relativeScreenshotDir, $file.Name)
        lines      = $lines
        text       = ($lines -join "`n")
    }
}

$json = $records | ConvertTo-Json -Depth 6
[System.IO.File]::WriteAllText(
    $RawOutput,
    $json,
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host ("Saved OCR output for {0} screenshots to {1}" -f $records.Count, $RawOutput)
