# Put `agentswarm` on your PATH, so it works from any folder.
#
# Without this you can only launch from the project directory. That matters more
# than it sounds: a pane's working directory decides which project's transcripts
# and swarms it reads, so running it from the repo you are actually working in is
# the normal case, not the exception.
#
#   powershell -ExecutionPolicy Bypass -File scripts\add-to-path.ps1
#
# Adds to the *user* PATH only — no admin, nothing machine-wide, and reversible
# by removing the same entry from the same place.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

if (-not (Test-Path (Join-Path $root 'agentswarm.cmd'))) {
    Write-Host "agentswarm.cmd not found in $root — run this from the project." -ForegroundColor Red
    exit 1
}

$current = [Environment]::GetEnvironmentVariable('Path', 'User')
$entries = ($current -split ';') | Where-Object { $_ -ne '' }

if ($entries -contains $root) {
    Write-Host "Already on your PATH: $root"
} else {
    [Environment]::SetEnvironmentVariable('Path', (($entries + $root) -join ';'), 'User')
    Write-Host "Added to your user PATH: $root" -ForegroundColor Green
}

Write-Host ""
Write-Host "Open a NEW terminal, then from any folder:"
Write-Host "  agentswarm                  " -NoNewline; Write-Host "reopen what you had" -ForegroundColor DarkGray
Write-Host "  agentswarm --swarm morning  " -NoNewline; Write-Host "open a named swarm" -ForegroundColor DarkGray
Write-Host ""
Write-Host "This shell already has the old PATH. For right now, use:"
Write-Host "  .\agentswarm" -ForegroundColor Cyan
