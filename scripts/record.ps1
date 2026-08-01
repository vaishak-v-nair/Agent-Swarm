# Record AgentSwarm actually working, without touching the keyboard.
#
#   powershell -ExecutionPolicy Bypass -File scripts\record.ps1
#
# This is the artifact half of the smoke test. A build log that says "verified"
# is a claim; a build log that links thirty seconds of the app opening a swarm,
# spawning panes and streaming real agent output is evidence. It is also the
# thing to send a teammate, which is the exit test that has gone unrun since M2
# for want of anything to show.
#
# It sends NO input. Not one keystroke, not one click. Earlier attempts at
# driving this app for verification put a keystroke into a fullscreen game,
# because driving needs focus and focus belongs to whoever is using the machine.
#
# It does not need to. Opening a swarm is self-driving: panes spawn, agents boot,
# output flows, the muster rail fills in, states move from working to idle. The
# recorder only has to watch. PrintWindow copies the window's own pixels, so the
# capture keeps working even if the window is behind something else.
#
# Output: a .mp4, and a self-contained .html flipbook that needs no player.

$ErrorActionPreference = 'Stop'
$root    = Split-Path -Parent $PSScriptRoot
$exe     = Join-Path $root 'app\src-tauri\target\release\agentswarm.exe'
$outDir  = Join-Path $root 'app\src-tauri\target\release\recording'
$frames  = Join-Path $outDir 'frames'
$seconds = 24
$fps     = 4

if (-not (Test-Path $exe)) { Write-Host "not built - cd app; npx tauri build --no-bundle" -ForegroundColor Red; exit 1 }

Remove-Item $outDir -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $frames -Force | Out-Null

Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class Win {
  // PW_RENDERFULLCONTENT (2) is what makes this work for a WebView2 window:
  // without it the browser surface comes back blank.
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr dc, uint flags);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
}
'@

Write-Host "AgentSwarm recorder" -ForegroundColor White
Write-Host "  no input is sent - the app drives itself" -ForegroundColor DarkGray

Get-Process agentswarm -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 800

$log = Join-Path $env:TEMP 'agentswarm-record.log'
Remove-Item $log -ErrorAction SilentlyContinue
$proc = Start-Process -FilePath $exe -ArgumentList '--swarm','morning' `
        -WorkingDirectory $root -PassThru -RedirectStandardOutput $log

# Let the window exist and lay itself out before the first frame.
Start-Sleep -Seconds 3
$win = Get-Process agentswarm -ErrorAction SilentlyContinue |
       Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $win) { Write-Host "  no window appeared" -ForegroundColor Red; exit 1 }

$h = $win.MainWindowHandle
$r = New-Object Win+RECT
[void][Win]::GetWindowRect($h, [ref]$r)
$w = $r.R - $r.L; $ht = $r.B - $r.T
Write-Host "  capturing ${w}x${ht} for ${seconds}s at ${fps}fps"

$total = $seconds * $fps
$blank = 0
for ($i = 0; $i -lt $total; $i++) {
    $bmp = New-Object System.Drawing.Bitmap $w, $ht
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $dc  = $g.GetHdc()
    $okc = [Win]::PrintWindow($h, $dc, 2)
    $g.ReleaseHdc($dc); $g.Dispose()

    if ($okc) {
        # A frame that is one flat colour means PrintWindow returned an empty
        # surface. Worth counting rather than shipping a video of nothing.
        $c1 = $bmp.GetPixel([int]($w/2), [int]($ht/2))
        $c2 = $bmp.GetPixel(12, [int]($ht/2))
        if ($c1 -eq $c2) { $blank++ }
        $bmp.Save((Join-Path $frames ("f{0:d4}.png" -f $i)), [System.Drawing.Imaging.ImageFormat]::Png)
    }
    $bmp.Dispose()
    Start-Sleep -Milliseconds ([int](1000 / $fps))
}

Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
$count = (Get-ChildItem $frames -Filter *.png -ErrorAction SilentlyContinue).Count
Write-Host "  $count frame(s), $blank looked blank"

if ($count -eq 0) { Write-Host "  capture failed" -ForegroundColor Red; exit 1 }
if ($blank -gt ($count * 0.8)) {
    Write-Host "  most frames are blank - PrintWindow did not reach the webview surface" -ForegroundColor Yellow
    Write-Host "  frames kept at $frames so this can be diagnosed rather than guessed at" -ForegroundColor DarkGray
}

# mp4 for sending to a person; the flipbook for anyone without a player.
$mp4 = Join-Path $outDir 'agentswarm.mp4'
& ffmpeg -y -loglevel error -framerate $fps -i (Join-Path $frames 'f%04d.png') `
    -vf "scale=1280:-2:flags=lanczos" -c:v libx264 -pix_fmt yuv420p -crf 24 $mp4 2>&1 | Out-Null
if (Test-Path $mp4) {
    Write-Host ("  mp4  {0}  ({1:n1} MB)" -f $mp4, ((Get-Item $mp4).Length / 1MB)) -ForegroundColor Green
}

# What the app said while being filmed, so the recording has a transcript.
$said = if (Test-Path $log) { (Get-Content $log) -join "`n" } else { "" }
$diag = ($said -split "`n" | Select-String '^\[ui\]|^\[rust\]' | Select-Object -First 14) -join "`n"

$flip = Join-Path $outDir 'agentswarm.html'
@"
<!doctype html><meta charset="utf-8"><title>AgentSwarm, working</title>
<style>
 body{background:#141519;color:#d8d6d1;font:13px/1.5 "Segoe UI",system-ui,sans-serif;margin:0;padding:24px}
 h1{font-size:14px;letter-spacing:.08em;color:#d6547a;font-weight:600;margin:0 0 4px}
 p{color:#7d7f86;font-size:12px;margin:0 0 16px}
 video{width:100%;max-width:1100px;border:1px solid #282a30;border-radius:10px;display:block}
 pre{background:#1b1c21;border:1px solid #282a30;border-radius:10px;padding:12px 14px;
     font-family:"Cascadia Mono",Consolas,monospace;font-size:11px;color:#7d7f86;
     max-width:1100px;overflow-x:auto;margin-top:16px}
</style>
<h1>agentswarm</h1>
<p>Recorded $(Get-Date -Format 'yyyy-MM-dd HH:mm') — the app opening a swarm on its own. No input was sent.</p>
<video src="agentswarm.mp4" autoplay loop muted playsinline></video>
<pre>$([System.Web.HttpUtility]::HtmlEncode($diag))</pre>
"@ | Set-Content $flip -Encoding UTF8

Write-Host "  html $flip" -ForegroundColor Green
Write-Host ""
Write-Host "Send the mp4. Open the html to watch it with what the app was saying." -ForegroundColor White
