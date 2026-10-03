# Fake voice: speaks text (or SSML, for pauses: <break time="2s"/>) into a 16 kHz mono WAV,
# the format the web app uploads. Usage: ./say.ps1 -Text "Buy milk" -Out out/milk.wav
#                                        ./say.ps1 -Ssml '<speak ...>' -Out out/x.wav
param([string]$Text, [string]$Ssml, [Parameter(Mandatory)] [string]$Out, [string]$Culture = 'en-US')
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voice = $synth.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -eq $Culture } | Select-Object -First 1
if ($voice) { $synth.SelectVoice($voice.VoiceInfo.Name) }
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
New-Item -ItemType Directory -Force (Split-Path -Parent ([IO.Path]::GetFullPath($Out))) | Out-Null
$synth.SetOutputToWaveFile([IO.Path]::GetFullPath($Out), $fmt)
if ($Ssml) { $synth.SpeakSsml($Ssml) } else { $synth.Speak($Text) }
$synth.Dispose()
Write-Output "wrote $Out"
