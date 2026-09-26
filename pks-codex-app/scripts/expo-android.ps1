# Liga o emulador (se nenhum aparelho estiver conectado) e abre o app nele.
param([string]$Avd = 'Pixel_4')

$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$adb = Join-Path $sdk 'platform-tools\adb.exe'
$emulator = Join-Path $sdk 'emulator\emulator.exe'

if (-not (Test-Path $adb)) { throw "adb nao encontrado em $adb. Instale o Android SDK Platform-Tools pelo Android Studio." }

$devices = & $adb devices | Select-String -Pattern '\tdevice$'
if (-not $devices) {
  if (-not (Test-Path $emulator)) { throw "Emulador nao encontrado em $emulator." }
  Write-Host "Nenhum aparelho conectado. Ligando o emulador $Avd..."
  Start-Process -FilePath $emulator -ArgumentList '-avd', $Avd -WindowStyle Hidden
  & $adb wait-for-device
  Write-Host 'Aguardando o Android terminar de iniciar...'
  do {
    Start-Sleep -Seconds 2
    $booted = (& $adb shell getprop sys.boot_completed 2>$null) -join ''
  } until ($booted.Trim() -eq '1')
  Write-Host 'Emulador pronto.'
}

npx expo start --android
