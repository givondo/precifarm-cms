<#
Deploy the Precifarm operations CMS to Cloud Run at https://cms.precifarm.com

Run from the precifarm-cms folder in Windows PowerShell after `gcloud auth login`:
  powershell -ExecutionPolicy Bypass -File deploy\deploy-cms.ps1 -Project YOUR_PROJECT_ID

What it does (each step is skipped when it already exists, so it is safe to run again for every update):
  1. Enables Cloud Run, Cloud Build, Artifact Registry, Secret Manager and Cloud Storage.
  2. Creates a private bucket for the CMS data (mounted at /data), with object versioning so an
     earlier copy of the data can always be restored.
  3. Asks for the admin password once and stores only its scrypt hash, plus a random session key and
     an M-Pesa callback token, in Secret Manager. Use -NewPassword to change the password later
     (that signs everyone out).
  4. Creates a service account that can read those secrets and write that one bucket, nothing else.
  5. Builds the image with Cloud Build.
  6. Deploys the service: one instance at most, scales to zero, payments in demo mode,
     retired passenger booking off (BOOKING_ENABLED=false), answering only on cms.precifarm.com and its run.app names.
  7. Maps cms.precifarm.com and prints the DNS record to add at Hostinger.
Needs gcloud, node and git on PATH.

Database mode: if a service with this name already runs with a database (DATABASE_URL or
SUPABASE_DB_PASSWORD), the script updates it in place instead: data stays in the database, every
existing setting is kept (payments included), the service keeps its own account, and nothing changes
until you type UPDATE. It prints the current revision and the command to roll back to it.

Approval: AP-023 (tier C), recorded 21 October 2026.
#>
param(
  [Parameter(Mandatory = $true)][string]$Project,
  [string]$AdminEmail = "david.givondoh@gmail.com",
  [string]$AdminName = "David Givondo",
  [string]$Region = "europe-west1",
  [string]$RegistryRegion = "africa-south1",
  [string]$Domain = "cms.precifarm.com",
  [string]$Service = "precifarm-cms",
  [switch]$NewPassword
)
$ErrorActionPreference = "Stop"
function Step($t) { Write-Host "`n== $t" -ForegroundColor Cyan }
function Run([string[]]$a) {
  $old = $ErrorActionPreference; $ErrorActionPreference = "Continue"
  try { & gcloud @a } finally { $ErrorActionPreference = $old }
  if ($LASTEXITCODE -ne 0) { throw "gcloud $($a -join ' ') failed" }
}
function Exists([string[]]$a) {
  # Windows PowerShell 5.1 turns a native command's stderr into a terminating error under "Stop";
  # a "not found" here is an expected answer, so relax it for this call only.
  $old = $ErrorActionPreference; $ErrorActionPreference = "Continue"
  try { & gcloud @a 2>&1 | Out-Null; return ($LASTEXITCODE -eq 0) } finally { $ErrorActionPreference = $old }
}
function SecretFromString($name, $value) {
  $tmp = [IO.Path]::GetTempFileName()
  try {
    [IO.File]::WriteAllText($tmp, $value)   # no trailing newline
    if (Exists @("secrets", "describe", $name, "--project", $Project)) { Run @("secrets", "versions", "add", $name, "--data-file=$tmp", "--project", $Project) }
    else { Run @("secrets", "create", $name, "--data-file=$tmp", "--replication-policy=automatic", "--project", $Project) }
  } finally { Remove-Item $tmp -Force -ErrorAction SilentlyContinue }
}
function RandomKey($n) { $b = New-Object byte[] $n; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); return ([Convert]::ToBase64String($b)).Replace("+", "-").Replace("/", "_").TrimEnd("=") }

$Root = Split-Path -Parent $PSScriptRoot           # the precifarm-cms folder
$Bucket = "$Project-precifarm-cms-data"
$Sa = "precifarm-cms@$Project.iam.gserviceaccount.com"
$Image = "$RegistryRegion-docker.pkg.dev/$Project/precifarm/cms"

foreach ($tool in @("gcloud", "node", "git")) { if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "$tool is not installed or not on PATH." } }
$ErrorActionPreference = "Continue"; $Account = (& gcloud config get-value account 2>$null); $ErrorActionPreference = "Stop"
if (-not $Account) { throw "Sign in first: gcloud auth login" }
if ($AdminEmail -notmatch "^[^@\s]+@[^@\s]+\.[^@\s]+$") { throw "AdminEmail does not look like an email address." }
Write-Host "Deploying as $Account to project $Project"

Step "1. Services"
Run @("services", "enable", "run.googleapis.com", "cloudbuild.googleapis.com", "artifactregistry.googleapis.com", "secretmanager.googleapis.com", "storage.googleapis.com", "--project", $Project)
if (-not (Exists @("artifacts", "repositories", "describe", "precifarm", "--location", $RegistryRegion, "--project", $Project))) {
  Run @("artifacts", "repositories", "create", "precifarm", "--repository-format=docker", "--location", $RegistryRegion, "--description=Precifarm containers", "--project", $Project)
}

Step "1b. Existing service"
$ErrorActionPreference = "Continue"
$number = (& gcloud projects describe $Project --format "value(projectNumber)" 2>$null)
$out = (& gcloud run services describe $Service --region $Region --project $Project --quiet --format json 2>&1 | Out-String)
$code = $LASTEXITCODE
$ErrorActionPreference = "Stop"
$svc = $null
if ($code -eq 0) { $svc = ($out | ConvertFrom-Json) }
elseif ($out -notmatch "Cannot find service|could not be found|NOT_FOUND|does not exist") {
  # Anything other than "not found" (permissions, network, API) means we cannot tell; stop safely.
  throw "Could not check for an existing ${Service}: $out"
}
$out = $null   # the description can hold settings; keep it out of the transcript
# Settings the live service already has: literal values and Secret Manager references, kept as they are.
$plainEnv = [ordered]@{}; $secretRefs = [ordered]@{}
if ($svc) {
  foreach ($e in @($svc.spec.template.spec.containers[0].env)) {
    if (-not $e -or -not $e.name) { continue }
    if ($e.valueFrom -and $e.valueFrom.secretKeyRef) { $secretRefs[$e.name] = $true } else { $plainEnv[$e.name] = [string]$e.value }
  }
}
$DbMode = $plainEnv.Contains("DATABASE_URL") -or $plainEnv.Contains("SUPABASE_DB_PASSWORD") -or $secretRefs.Contains("DATABASE_URL") -or $secretRefs.Contains("SUPABASE_DB_PASSWORD")
$RunSa = $Sa
if ($DbMode) {
  $RunSa = [string]$svc.spec.template.spec.serviceAccountName
  if (-not $RunSa) { $RunSa = "$number-compute@developer.gserviceaccount.com" }
  $current = [string]$svc.status.latestReadyRevisionName
  if ($plainEnv.Contains("DEMO_PAYMENT")) { $payment = "DEMO_PAYMENT=" + $plainEnv["DEMO_PAYMENT"] } elseif ($secretRefs.Contains("DEMO_PAYMENT")) { $payment = "DEMO_PAYMENT from Secret Manager" } else { $payment = "DEMO_PAYMENT not set (demo mode)" }
  Write-Host ""
  Write-Host "$Service is live in $Region with a database. This run updates it in place:" -ForegroundColor Yellow
  Write-Host "  - data stays in its database; every existing setting is kept, including payments ($payment)"
  Write-Host "  - new code: signed sessions, hashed passwords, retired booking off, page and host protection"
  Write-Host "  - sign-in becomes $AdminEmail with the password you choose; accounts on the old published"
  Write-Host "    password are switched off, and other accounts need a password reset (scripts/set-agent-password.ts)"
  Write-Host "  - current revision: $current"
  Write-Host "    to undo: gcloud run services update-traffic $Service --region $Region --project $Project --to-revisions $current=100"
  $answer = Read-Host "Type UPDATE to go ahead (anything else stops with nothing changed)"
  if ($answer -cne "UPDATE") { throw "Stopped. Nothing was changed." }
} elseif ($svc) { Write-Host "Updating the existing $Service (no database configured on it)." } else { Write-Host "No $Service yet in $Region; creating it." }

if (-not $DbMode) {
  Step "2. Private bucket gs://$Bucket"
  if (-not (Exists @("storage", "buckets", "describe", "gs://$Bucket", "--project", $Project))) {
    Run @("storage", "buckets", "create", "gs://$Bucket", "--location", $Region, "--uniform-bucket-level-access", "--public-access-prevention", "--project", $Project)
  }
  # Keep earlier versions of the data file so a bad write can be rolled back: 30 days of history,
  # by age only, so a burst of writes can never push the good versions out.
  Run @("storage", "buckets", "update", "gs://$Bucket", "--versioning", "--project", $Project)
  $life = [IO.Path]::GetTempFileName()
  try {
    [IO.File]::WriteAllText($life, '{"rule":[{"action":{"type":"Delete"},"condition":{"isLive":false,"daysSinceNoncurrentTime":30}}]}')
    Run @("storage", "buckets", "update", "gs://$Bucket", "--lifecycle-file=$life", "--project", $Project)
  } finally { Remove-Item $life -Force -ErrorAction SilentlyContinue }
}

Step "3. Admin password, session key and callback token"
if ($NewPassword -or -not (Exists @("secrets", "describe", "cms-admin-password-hash", "--project", $Project))) {
  Write-Host "Choose the CMS admin password for $AdminEmail (12 characters or more). Only its hash is stored."
  # PowerShell masks the typing itself (Read-Host -AsSecureString); node only hashes what it is given.
  function Plain($sec) { $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec); try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) } }
  $p1 = Plain (Read-Host "CMS admin password" -AsSecureString)
  $p2 = Plain (Read-Host "Type it again" -AsSecureString)
  if ($p1 -ne $p2) { throw "The two entries differ. Nothing was stored; run the script again." }
  if ($p1.Length -lt 12) { throw "Use at least 12 characters. Nothing was stored; run the script again." }
  $OutputEncoding = New-Object System.Text.UTF8Encoding $false   # pass any character through unchanged
  $ErrorActionPreference = "Continue"; $hash = $p1 | & node (Join-Path $Root "scripts\hash-password.mjs") --stdin; $ErrorActionPreference = "Stop"
  $p1 = $null; $p2 = $null
  if ($LASTEXITCODE -ne 0 -or -not $hash) { throw "Password not set." }
  SecretFromString "cms-admin-password-hash" ($hash | Select-Object -Last 1)
  # A new key signs everyone out, which is what changing the password should do.
  SecretFromString "cms-session-secret" (RandomKey 48)
} else { Write-Host "Password already set (use -NewPassword to change it)." }
if (-not (Exists @("secrets", "describe", "cms-mpesa-callback-token", "--project", $Project))) {
  # Safaricom must call back with ?token=<this>; without it every callback is refused.
  SecretFromString "cms-mpesa-callback-token" (RandomKey 32)
}

Step "4. Service account with the least access"
if (-not (Exists @("iam", "service-accounts", "describe", $Sa, "--project", $Project))) {
  Run @("iam", "service-accounts", "create", "precifarm-cms", "--display-name=Precifarm CMS", "--project", $Project)
}
# In database mode the service keeps its own account, which already reads the database secrets.
foreach ($s in @("cms-admin-password-hash", "cms-session-secret", "cms-mpesa-callback-token")) {
  Run @("secrets", "add-iam-policy-binding", $s, "--member=serviceAccount:$RunSa", "--role=roles/secretmanager.secretAccessor", "--project", $Project, "--quiet")
}
if (-not $DbMode) {
  Run @("storage", "buckets", "add-iam-policy-binding", "gs://$Bucket", "--member=serviceAccount:$Sa", "--role=roles/storage.objectUser", "--project", $Project)
}

Step "5. Build the image"
# A copy synced by Claude records the branch commit it matches in .deploy-commit; otherwise use git.
$marker = Join-Path $Root ".deploy-commit"
if (Test-Path $marker) { $Commit = (Get-Content $marker -Raw).Trim() } else { $Commit = (& git -C $Root rev-parse --short HEAD).Trim() }
Push-Location $Root
try { Run @("builds", "submit", "--tag", "${Image}:$Commit", "--project", $Project, ".") } finally { Pop-Location }

Step "6. Deploy $Service"
# Cloud Run answers on the deterministic SERVICE-PROJECTNUMBER.REGION.run.app name, the older hashed
# one in status.url, and any custom domains already mapped to it. Allow those and cms.precifarm.com;
# every other Host header gets a 421.
$ErrorActionPreference = "Continue"
$legacy = (& gcloud run services describe $Service --region $Region --project $Project --format "value(status.url)" 2>$null)
$mapped = @(& gcloud beta run domain-mappings list --region $Region --project $Project --format "value(metadata.name,spec.routeName)" 2>$null)
$ErrorActionPreference = "Stop"
# api.precifarm.com is the website's CMS_API_URL and the mobile app's API host: always allowed.
$hostList = @($Domain, "api.precifarm.com")
if ($number) { $hostList += "$Service-$number.$Region.run.app" }
if ($legacy) { $hostList += ([Uri]$legacy).Host }
foreach ($line in $mapped) { $f = "$line".Split("`t", [StringSplitOptions]::RemoveEmptyEntries); if ($f.Count -ge 2 -and $f[1].Trim() -eq $Service) { $hostList += $f[0].Trim() } }
$hosts = ($hostList | Select-Object -Unique) -join ","
$ours = @("CMS_ADMIN_PASSWORD_HASH", "SESSION_SECRET", "MPESA_CALLBACK_TOKEN")
# Settings go through a file, not --set-env-vars: values contain "@", "," and spaces.
function EnvFile($allowed) {
  $vars = [ordered]@{}
  if ($DbMode) {
    # Keep every literal setting the live service has, except names that now come from Secret Manager.
    foreach ($k in $plainEnv.Keys) { if ($ours -notcontains $k) { $vars[$k] = $plainEnv[$k] } }
  } else {
    $vars["CMS_DATA_DIR"] = "/data"; $vars["DEMO_PAYMENT"] = "true"
    $vars["NEXT_PUBLIC_SITE_URL"] = "https://precifarm.com"; $vars["ANALYTICS_ENVIRONMENT"] = "production"
  }
  $vars["CMS_ALLOWED_HOSTS"] = $allowed; $vars["CMS_ADMIN_EMAIL"] = $AdminEmail; $vars["CMS_ADMIN_NAME"] = $AdminName; $vars["BOOKING_ENABLED"] = "false"
  foreach ($k in @($vars.Keys)) { if ($secretRefs.Contains($k)) { $vars.Remove($k) } }   # never shadow a secret
  $f = [IO.Path]::GetTempFileName()
  [IO.File]::WriteAllText($f, ($vars | ConvertTo-Json))   # JSON is valid YAML for --env-vars-file
  return $f
}
$secretMap = "CMS_ADMIN_PASSWORD_HASH=cms-admin-password-hash:latest,SESSION_SECRET=cms-session-secret:latest,MPESA_CALLBACK_TOKEN=cms-mpesa-callback-token:latest"
$envFile = EnvFile $hosts
try {
  if ($DbMode) {
    # In place: new image, the three new secrets and these settings; scaling, database secrets and
    # everything else stay as configured.
    Run @("run", "deploy", $Service,
      "--image", "${Image}:$Commit", "--region", $Region, "--project", $Project,
      "--service-account", $RunSa, "--allow-unauthenticated",
      "--update-secrets", $secretMap,
      "--env-vars-file", $envFile)
  } else {
    Run @("run", "deploy", $Service,
      "--image", "${Image}:$Commit", "--region", $Region, "--project", $Project,
      "--service-account", $Sa, "--allow-unauthenticated", "--port", "8080",
      "--execution-environment", "gen2", "--min-instances", "0", "--max-instances", "1",
      "--cpu", "1", "--memory", "1Gi", "--timeout", "300", "--concurrency", "20",
      "--set-secrets", $secretMap,
      "--env-vars-file", $envFile,
      "--clear-volumes", "--clear-volume-mounts",
      "--add-volume", "name=data,type=cloud-storage,bucket=$Bucket,mount-options=uid=1001;gid=1001",
      "--add-volume-mount", "volume=data,mount-path=/data")
  }
} finally { Remove-Item $envFile -Force -ErrorAction SilentlyContinue }
$ErrorActionPreference = "Continue"; $legacy = (& gcloud run services describe $Service --region $Region --project $Project --format "value(status.url)" 2>$null); $ErrorActionPreference = "Stop"
if ($legacy -and $hosts -notlike "*$(([Uri]$legacy).Host)*") {
  # First deploy: the hashed run.app name exists only now.
  $hosts = "$hosts,$(([Uri]$legacy).Host)"
  $envFile = EnvFile $hosts
  try { Run @("run", "services", "update", $Service, "--region", $Region, "--project", $Project, "--env-vars-file", $envFile) }
  finally { Remove-Item $envFile -Force -ErrorAction SilentlyContinue }
}
$url = "https://" + $hostList[2]

Step "7. Domain $Domain"
# Domain mappings with --region are a beta command in current gcloud releases.
if (-not (Exists @("beta", "run", "domain-mappings", "describe", "--domain", $Domain, "--region", $Region, "--project", $Project))) {
  Run @("beta", "run", "domain-mappings", "create", "--service", $Service, "--domain", $Domain, "--region", $Region, "--project", $Project)
}
$sub = $Domain.Split(".")[0]
Write-Host ""
Write-Host "Deployed: $url  (sign in as $AdminEmail with the password you chose)" -ForegroundColor Green
Write-Host "At Hostinger, DNS for precifarm.com, add once:"
Write-Host "  Type CNAME   Name $sub   Value ghs.googlehosted.com"
Write-Host "Google issues the certificate 15 to 60 minutes after the record resolves; then open https://$Domain"
