# Builds Double Scoop (doublescoop/) into wwwroot/games/doublescoop for `dotnet run`.
# Docker builds do this in the Dockerfile instead.
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root "doublescoop"
$target = Join-Path $root "wwwroot/games/doublescoop"

Push-Location $source
try {
    npm ci
    if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
}
finally {
    Pop-Location
}

if (Test-Path $target) { Remove-Item -Recurse -Force $target }
Copy-Item -Recurse (Join-Path $source "dist") $target
Write-Host "Double Scoop built into $target"
