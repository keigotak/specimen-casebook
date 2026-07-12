param(
  [string]$OutputDirectory = ".\demo\audio",
  [int]$Rate = -1,
  [string]$Voice = "Microsoft David Desktop"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$segments = Get-Content -Raw (Join-Path $PSScriptRoot "narration.json") | ConvertFrom-Json
$output = [System.IO.Path]::GetFullPath((Join-Path $repoRoot $OutputDirectory))
New-Item -ItemType Directory -Force -Path $output | Out-Null

Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice($Voice)
$synth.Rate = $Rate
$synth.Volume = 100

try {
  foreach ($segment in $segments) {
    $path = Join-Path $output ("narration-{0}.wav" -f $segment.id)
    $synth.SetOutputToWaveFile($path)
    $synth.Speak([string]$segment.text)
  }
}
finally {
  $synth.SetOutputToNull()
  $synth.Dispose()
}

Write-Output $output
