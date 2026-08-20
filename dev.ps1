$env:Path = "C:\Program Files\nodejs;" + $env:Path
Set-Location (Join-Path $PSScriptRoot "app")
npm run dev
