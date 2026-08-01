# Launch the real AgentSwarm and prove it works.
#
#   powershell -ExecutionPolicy Bypass -File scripts\smoke.ps1
#
# This exists because thirteen milestones shipped "verified" and the first person
# to launch the app hit five defects in minutes. Every one of them was reachable
# by starting the binary and looking at it. Unit tests and a browser harness both
# passed the whole time, because neither of them ever started the binary.
#
# So this starts the binary. Not the harness, not a mock — the same exe the
# installer ships. It asserts on three things a test can actually see:
#
#   1. the app comes up at all              (the PATH / launch class)
#   2. the window keeps responding          (the frozen-UI class)
#   3. the panes it claims are the panes it opened, running what they should be,
#      and no pane claims a session record it has no right to
#                                           (the borrowed-transcript class)
#
# What it deliberately does NOT do is send keystrokes. Driving the UI needs the
# window focused, and stealing focus on a machine somebody is using once put a
# keystroke into their game. Click-target bugs are covered by app/harness.html,
# which drives the same DOM without touching the desktop. The gap between them
# is stated in the summary rather than papered over.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$exe  = Join-Path $root 'app\src-tauri\target\release\agentswarm.exe'
$fail = 0
$warn = 0

function Pass($m) { Write-Host "  ok    $m" -ForegroundColor Green }
function Fail($m) { Write-Host "  FAIL  $m" -ForegroundColor Red;    $script:fail++ }
function Warn($m) { Write-Host "  warn  $m" -ForegroundColor Yellow; $script:warn++ }
function Step($m) { Write-Host "`n$m" -ForegroundColor Cyan }

Write-Host "AgentSwarm smoke test" -ForegroundColor White
Write-Host "  $exe"

if (-not (Test-Path $exe)) {
    Fail "not built - run: cd app; npx tauri build --no-bundle"
    exit 1
}

# ── the environment, before the window ───────────────────────────────────────
Step "doctor"
# Start-Process, not `&` — an inline call's $LASTEXITCODE came back empty when
# its output was captured, so the check silently compared against nothing.
$dOut = Join-Path $env:TEMP 'agentswarm-doctor.txt'
$d = Start-Process -FilePath $exe -ArgumentList '--doctor' -WorkingDirectory $root `
     -NoNewWindow -Wait -PassThru -RedirectStandardOutput $dOut
if (Test-Path $dOut) { Get-Content $dOut | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray } }
if ($d.ExitCode -eq 0) { Pass "every check passed" }
else { Warn "doctor reported $($d.ExitCode) problem(s) - see above" }

# ── launch ───────────────────────────────────────────────────────────────────
Step "launch"
Get-Process agentswarm -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 800

$log = Join-Path $env:TEMP "agentswarm-smoke.log"
Remove-Item $log -ErrorAction SilentlyContinue
$proc = Start-Process -FilePath $exe -ArgumentList '--swarm','morning' `
        -WorkingDirectory $root -PassThru -RedirectStandardOutput $log -WindowStyle Minimized

Start-Sleep -Seconds 20

if ($proc.HasExited) {
    Fail "exited immediately with code $($proc.ExitCode)"
    if (Test-Path $log) { Get-Content $log | Select-Object -Last 30 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray } }
    exit 1
}
Pass "still running after 20s"

$win = Get-Process agentswarm -ErrorAction SilentlyContinue |
       Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if ($win) { Pass "window open: $($win.MainWindowTitle)" } else { Fail "no window appeared" }

# ── responsiveness: the "not responding" class ───────────────────────────────
Step "responsiveness"
$stalls = 0
foreach ($i in 1..6) {
    Start-Sleep -Milliseconds 700
    $p = Get-Process -Id $proc.Id -ErrorAction SilentlyContinue
    if ($p -and -not $p.Responding) { $stalls++ }
}
if ($stalls -eq 0) { Pass "responded on all 6 samples" }
else { Fail "window stopped responding on $stalls of 6 samples" }

$mb = [math]::Round((Get-Process -Id $proc.Id).WorkingSet64 / 1MB, 1)
if ($mb -lt 250) { Pass "memory ${mb} MB" } else { Warn "memory ${mb} MB - higher than expected" }

# ── what it actually opened ──────────────────────────────────────────────────
Step "panes"
$out = if (Test-Path $log) { Get-Content $log -Raw } else { "" }

$spawned = ([regex]::Matches($out, 'spawned at \d+x\d+')).Count
if ($spawned -ge 2) { Pass "$spawned pane(s) spawned" } else { Fail "expected 2 panes from the morning swarm, saw $spawned" }

$children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$($proc.Id)" |
            Where-Object { $_.Name -like '*powershell*' -or $_.Name -like '*cmd*' }
if ($children.Count -ge 2) { Pass "$($children.Count) real shell process(es)" }
else { Fail "panes were drawn but only $($children.Count) process(es) exist" }

# The regression that made a shell pane display another session's work.
$borrowed = [regex]::Matches($out, 'pane (\d+) \((powershell|pwsh|cmd|wsl)\)[\s\S]{0,200}?semantic layer live')
if ($borrowed.Count -eq 0) { Pass "no shell pane claimed a session record" }
else { Fail "a shell pane attached to a transcript - the borrowed-transcript bug is back" }

if ($out -match 'FATAL|window error|unhandled rejection') {
    Fail "frontend reported an error"
    ($out -split "`n" | Select-String 'FATAL|window error|unhandled rejection') |
        ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
} else { Pass "no frontend errors" }

# ── shutdown ─────────────────────────────────────────────────────────────────
Step "shutdown"
Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 900
if (Get-Process agentswarm -ErrorAction SilentlyContinue) { Warn "a process survived being killed" }
else { Pass "exited cleanly" }

# ── verdict ──────────────────────────────────────────────────────────────────
Write-Host ""
if ($fail -eq 0) {
    Write-Host "PASS" -ForegroundColor Green -NoNewline
    Write-Host "  $warn warning(s). Not covered here: click targets and typing - see app/harness.html."
    exit 0
} else {
    Write-Host "FAIL" -ForegroundColor Red -NoNewline
    Write-Host "  $fail failure(s), $warn warning(s). Log: $log"
    exit 1
}
