# Run from mobile: powershell -File scripts/Check-DemoFlow.ps1
$ErrorActionPreference = 'Stop'
function Read-DemoPassword([string]$Prompt) {
  $secure = Read-Host $Prompt -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
  $env:DEMO_PASSWORD_A = Read-DemoPassword 'Password for 1234@gmail.com (hidden)'
  $env:DEMO_PASSWORD_B = Read-DemoPassword 'Password for 5678@gmail.com (hidden)'
  node --env-file=.env scripts/check-demo-flow.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Demo verification failed. Check the step printed above.' }
} finally {
  Remove-Item Env:DEMO_PASSWORD_A -ErrorAction SilentlyContinue
  Remove-Item Env:DEMO_PASSWORD_B -ErrorAction SilentlyContinue
  Pop-Location
}
