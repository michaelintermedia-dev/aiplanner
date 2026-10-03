# Builds the API into tools/qa/.local/api and runs it on http://localhost:58600 against the dev
# database - a separate copy, so the developer's running backend (58442/58443) is never touched.
# Needs tools/qa/.local/conn.txt (the dev DB connection string; gitignored - see README).
# Run it in the background; stop it when done.
$ErrorActionPreference = 'Stop'
$qa = $PSScriptRoot
$local = Join-Path $qa '.local'
$conn = Join-Path $local 'conn.txt'
if (-not (Test-Path $conn)) { throw "Missing $conn - see tools/qa/README.md" }

$api = Join-Path $local 'api'
dotnet build (Join-Path $qa '..\..\backend\src\AiPlanner.Api') -v q -nologo -o $api | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'API build failed' }

Set-Location $api # content root: appsettings + App_Data live here
$env:ConnectionStrings__aiplannerdb = (Get-Content $conn -Raw).Trim()
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:Recordings__CleanupDryRun = 'true' # the cleanup job must never delete anything during QA
$ffmpeg = Join-Path $local 'ffmpeg.exe'
if (Test-Path $ffmpeg) { $env:Recordings__FfmpegPath = $ffmpeg }
dotnet .\AiPlanner.Api.dll --urls http://localhost:58600 2>&1 | Out-File (Join-Path $local 'api.log') -Encoding utf8
