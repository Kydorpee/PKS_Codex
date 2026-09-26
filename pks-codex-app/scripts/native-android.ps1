# Compila o app nativo (com o widget da tela inicial), instala no aparelho/emulador e abre.
# Diferente do Expo Go, este build inclui os modulos nativos do projeto.
Set-Location (Join-Path $PSScriptRoot '..')

if (-not $env:JAVA_HOME) { $env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr' }
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }

npx expo run:android
