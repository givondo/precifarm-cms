# Seed SEO content into production Cloud SQL (precifarm-db)
# Prerequisites: gcloud auth, Cloud SQL Auth Proxy on PATH or in Cloud SDK bin
# Usage: powershell -ExecutionPolicy Bypass -File scripts/seed-seo-production.ps1

$ErrorActionPreference = "Stop"

$GCLOUD = "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
$PROJECT = & $GCLOUD config get-value project 2>$null
if (-not $PROJECT) { Write-Error "Set GCP project: gcloud config set project YOUR_PROJECT_ID" }

$INSTANCE = "${PROJECT}:africa-south1:precifarm-db"
$PROXY_PORT = 9470

$proxy = Get-Command cloud-sql-proxy -ErrorAction SilentlyContinue
if (-not $proxy) {
  $proxyPath = "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\cloud-sql-proxy.exe"
  if (Test-Path $proxyPath) { $proxy = $proxyPath } else {
    Write-Error "Install Cloud SQL Auth Proxy: gcloud components install cloud-sql-proxy"
  }
} else {
  $proxy = $proxy.Source
}

Write-Host "Starting Cloud SQL Auth Proxy on port $PROXY_PORT..." -ForegroundColor Cyan
$proxyJob = Start-Job -ScriptBlock {
  param($proxyExe, $instance, $port)
  & $proxyExe $instance --port $port 2>&1
} -ArgumentList $proxy, $INSTANCE, $PROXY_PORT

Start-Sleep -Seconds 4

try {
  if (-not $env:DATABASE_URL) {
    Write-Host "Fetching DATABASE_URL from Secret Manager..." -ForegroundColor Cyan
    $raw = & $GCLOUD secrets versions access latest --secret=precifarm-database-url 2>&1
    if ($LASTEXITCODE -ne 0) { Write-Error "Could not read precifarm-database-url secret." }
    # Rewrite socket/host to local proxy TCP
    $env:DATABASE_URL = $raw -replace '@[^/]+/', "@127.0.0.1:${PROXY_PORT}/"
    $env:DATABASE_URL = $env:DATABASE_URL -replace '\?host=/cloudsql/[^&]+', ''
  }

  $env:NEXT_PUBLIC_SITE_URL = "https://precifarm.com"
  Write-Host "Running db:seed-seo against production..." -ForegroundColor Cyan
  npm run db:seed-seo
  if ($LASTEXITCODE -ne 0) { Write-Error "Seed failed." }
  Write-Host "Production SEO seed complete." -ForegroundColor Green
} finally {
  Stop-Job $proxyJob -ErrorAction SilentlyContinue
  Remove-Job $proxyJob -Force -ErrorAction SilentlyContinue
}
