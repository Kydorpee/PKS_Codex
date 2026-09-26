# Inicia o servidor do Expo. No terminal: a = Android, j = debug, r = recarregar.
# Use -Clear para limpar o cache do Metro.
param([switch]$Clear)

Set-Location (Join-Path $PSScriptRoot '..')
$expoArgs = @('expo', 'start')
if ($Clear) { $expoArgs += '--clear' }
npx @expoArgs
