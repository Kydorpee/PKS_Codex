# Roda o typecheck do app e os testes das regras do jogo.
Set-Location (Join-Path $PSScriptRoot '..')

Write-Host '== Typecheck =='
npx tsc --noEmit
$typecheck = $LASTEXITCODE
if ($typecheck -eq 0) { Write-Host 'Typecheck OK' }

Write-Host ''
Write-Host '== Testes =='
npm test
$tests = $LASTEXITCODE

if ($typecheck -ne 0 -or $tests -ne 0) { exit 1 }
