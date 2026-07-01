$ErrorActionPreference = "Stop"

Write-Host "Running CLI Smoke Tests..." -ForegroundColor Cyan

$rootDir = (Get-Item .).FullName
if (-not (Test-Path "$rootDir\cli\cognee_cli.py")) {
    Write-Host "Please run this script from the dev-context-cognee root directory." -ForegroundColor Red
    exit 1
}

$cli = "python -m cli.cognee_cli"

Write-Host "`n1. Testing config generation..."
Invoke-Expression "$cli config --show"

Write-Host "`n2. Starting daemon..."
Invoke-Expression "$cli start ."
Start-Sleep -Seconds 2

Write-Host "`n3. Checking status..."
Invoke-Expression "$cli status"

Write-Host "`n4. Triggering file change..."
Set-Content -Path "smoke_test_dummy.txt" -Value "Testing daemon ingest"
Start-Sleep -Seconds 2
Remove-Item "smoke_test_dummy.txt"

Write-Host "Waiting 32 seconds for daemon to flush buffer..."
Start-Sleep -Seconds 32

Write-Host "`n5. Testing recall (with backend API offline, this will just test CLI output format or graceful failure)..."
Invoke-Expression "$cli recall 'Testing daemon ingest'"

Write-Host "`n6. Ending daemon..."
Invoke-Expression "$cli end --no-distill"

Write-Host "`nSmoke tests finished." -ForegroundColor Green
