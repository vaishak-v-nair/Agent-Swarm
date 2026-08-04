# Mirror Claude Code's memory files onto E:, into the repo.
#
# WHY THIS EXISTS
# Claude Code reads memory from a fixed path under the Windows user profile,
# which is on C:. That path is not configurable, so the memory files cannot
# simply be moved — but they can be MIRRORED, and once they are in the repo
# they are version-controlled, diffable, and survive a C: reinstall.
#
# C: stays the working copy. E: holds the copy that matters.
#
#   .\scripts\sync-memory.ps1          # C: -> E:  (backup, the usual direction)
#   .\scripts\sync-memory.ps1 -Restore # E: -> C:  (after a fresh machine)

param([switch]$Restore)

$Src = "$env:USERPROFILE\.claude\projects\E--agent-swarm\memory"
$Dst = "E:\agent-swarm\AgentSwarm intelligence\06 Memory"

if ($Restore) { $from, $to = $Dst, $Src } else { $from, $to = $Src, $Dst }

if (-not (Test-Path $from)) { Write-Error "source missing: $from"; exit 1 }
New-Item -ItemType Directory -Force -Path $to | Out-Null

$n = 0
Get-ChildItem $from -Filter *.md -File | ForEach-Object {
    Copy-Item $_.FullName (Join-Path $to $_.Name) -Force
    $n++
}

$kb = [math]::Round(((Get-ChildItem $to -Filter *.md | Measure-Object Length -Sum).Sum / 1KB), 1)
Write-Output "$n memory files -> $to  ($kb KB)"
if (-not $Restore) { Write-Output "C: remains the live copy Claude Code reads; this is the backup." }
