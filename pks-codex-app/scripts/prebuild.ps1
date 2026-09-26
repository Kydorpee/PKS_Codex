# Regenera a pasta android/ a partir do app.json (rode depois de mudar plugins, icone ou widget).
# A pasta android/ e gerada: nao edite os arquivos dela a mao.
Set-Location (Join-Path $PSScriptRoot '..')

npx expo prebuild --platform android --clean
