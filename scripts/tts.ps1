param(
  [Parameter(Mandatory = $true)][string]$TextFile,
  [Parameter(Mandatory = $true)][string]$OutFile,
  [string]$Voice = 'Microsoft Huihui Desktop'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech

$text = Get-Content -LiteralPath $TextFile -Raw -Encoding UTF8
if ([string]::IsNullOrWhiteSpace($text)) { throw 'empty text' }

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $voices = @($synth.GetInstalledVoices() | Where-Object { $_.Enabled })
  $chosen = $voices | Where-Object { $_.VoiceInfo.Name -eq $Voice } | Select-Object -First 1
  if (-not $chosen) {
    $chosen = $voices | Where-Object { $_.VoiceInfo.Culture.Name -like 'zh-CN*' } | Select-Object -First 1
  }
  if (-not $chosen) { $chosen = $voices | Select-Object -First 1 }
  if (-not $chosen) { throw 'no speech voice installed' }

  $synth.SelectVoice($chosen.VoiceInfo.Name)
  $synth.Rate = 0
  $synth.Volume = 100
  $synth.SetOutputToWaveFile($OutFile)
  $synth.Speak($text)
} finally {
  $synth.Dispose()
}
