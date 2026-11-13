# ─── TurboDM development bootstrap (Windows) ────────────────────────
# scripts/dev-setup.ps1 — for development machines only. The END-USER
# installer (TurboDM-Setup-*.exe) does NOT need this: the packaged app
# runs on Electron's built-in Node and never touches Bun.
#
# What it does:
#   1. Installs Bun via the official installer (bun.sh) if missing
#   2. bun install            (project deps + postinstall hook)
#   3. bun test               (full suite)
#
# Run it:  scripts\dev-setup.bat   (double-clickable wrapper)
# or:      powershell -ExecutionPolicy Bypass -File scripts\dev-setup.ps1

$ErrorActionPreference = "Stop"

function Get-BunCommand {
    $cmd = Get-Command bun -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

$bun = Get-BunCommand
if (-not $bun) {
    # The official Bun installer puts bun.exe in %USERPROFILE%\.bun
    $localBun = Join-Path $env:USERPROFILE ".bun\bin\bun.exe"
    if (Test-Path $localBun) {
        $env:Path = "$env:USERPROFILE\.bin;" + "$env:USERPROFILE\.bun;" + $env:Path
        $bun = $localBun
    }
}
if (-not $bun) {
    Write-Host "== Installing Bun (official installer from bun.sh) ==" -ForegroundColor Cyan
    irm https://bun.sh/install.ps1 | iex
    $env:Path = "$env:USERPROFILE\.bun;" + $env:Path
    $bun = Get-BunCommand
    if (-not $bun -and (Test-Path (Join-Path $env:USERPROFILE ".bun\bin\bun.exe"))) {
        $bun = Join-Path $env:USERPROFILE ".bun\bin\bun.exe"
    }
    if (-not $bun) {
        throw "Bun was installed but is not on PATH yet. Open a NEW terminal and re-run this script."
    }
}
Write-Host "== Bun: $bun $(& $bun --version) ==" -ForegroundColor Green

Push-Location (Split-Path -Parent $PSScriptRoot)
try {
    Write-Host "`n== bun install ==" -ForegroundColor Cyan
    & $bun install
    if ($LASTEXITCODE -ne 0) { throw "bun install failed" }

    Write-Host "`n== bun test ==" -ForegroundColor Cyan
    & $bun test
    if ($LASTEXITCODE -ne 0) { throw "bun test failed" }

    Write-Host "`n== Dev setup complete ==" -ForegroundColor Green
    Write-Host "  bun run start  -> launch TurboDM from source"
    Write-Host "  bun run dist   -> build TurboDM-Setup-<version>.exe (installer)"
} finally {
    Pop-Location
}
