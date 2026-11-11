[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$varsPath = Join-Path $projectRoot ".dev.vars"
$examplePath = Join-Path $projectRoot ".dev.vars.example"

if (-not (Test-Path -LiteralPath $varsPath)) {
  Copy-Item -LiteralPath $examplePath -Destination $varsPath
}

$clientId = (Read-Host "Google OAuth Client ID").Trim()
$secureClientSecret = Read-Host "Google OAuth Client Secret" -AsSecureString
$clientSecret = [System.Net.NetworkCredential]::new("", $secureClientSecret).Password

if (-not $clientId.EndsWith(".apps.googleusercontent.com")) {
  throw "The Client ID should end with .apps.googleusercontent.com."
}
if ([string]::IsNullOrWhiteSpace($clientSecret)) {
  throw "The Client Secret cannot be empty."
}

$keyBytes = New-Object byte[] 32
$random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$random.GetBytes($keyBytes)
$random.Dispose()
$encryptionKey = [Convert]::ToBase64String($keyBytes)
$content = [System.IO.File]::ReadAllText($varsPath)

function Set-DevVariable([string]$name, [string]$value) {
  $script:content = [regex]::Replace(
    $script:content,
    "(?m)^$([regex]::Escape($name))=.*$",
    "$name=$value"
  )
  if ($script:content -notmatch "(?m)^$([regex]::Escape($name))=") {
    $script:content = $script:content.TrimEnd() + "`r`n$name=$value`r`n"
  }
}

Set-DevVariable "GOOGLE_CALENDAR_CLIENT_ID" $clientId
Set-DevVariable "GOOGLE_CALENDAR_CLIENT_SECRET" $clientSecret
Set-DevVariable "GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY" $encryptionKey

[System.IO.File]::WriteAllText($varsPath, $content, [System.Text.UTF8Encoding]::new($false))
$clientSecret = $null
$secureClientSecret.Dispose()

Write-Host "Google Calendar credentials were saved to .dev.vars (ignored by Git)."
Write-Host "Restart the development server before connecting Google Calendar."
