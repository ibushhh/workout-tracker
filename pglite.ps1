$env:Path = "C:\Program Files\nodejs;" + $env:Path
Set-Location (Join-Path $PSScriptRoot "server")
node test/pglite-server.js
