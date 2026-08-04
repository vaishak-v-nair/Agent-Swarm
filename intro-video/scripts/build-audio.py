"""Build the film's single master audio track.

Three layers, mixed once, in the tool that should own mixing:

  music  bedA -> bedB -> bedA, crossfaded, trimmed to length, faded at both ends
  voice  the eleven Kokoro lines, each placed at its exact cue
  sfx    the bundled Pixabay set, each placed on a visual hit

The music is side-chain ducked by the voice, so the bed steps back under a line
and returns after it, instead of being flat-quiet for the whole film.

Everything here is deterministic: same inputs, same master.wav.
"""

import subprocess, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(HERE)
A = os.path.join(PROJ, "assets", "audio").replace("\\", "/")
OUT = os.path.join(A, "master.wav")
TOTAL = 54.2

# (file, start_seconds) — cues follow STORYBOARD.md's frame starts.
VOICE = [
    ("v01", 0.80), ("v02", 5.90), ("v03", 10.30), ("v04", 14.95),
    ("v05", 19.20), ("v06", 24.70), ("v07", 29.90), ("v08", 33.30),
    ("v09", 36.80), ("v10", 41.90), ("v11", 52.10),
]

# (file, start_seconds, gain) — every one lands on something visible.
SFX = [
    ("impact-bass-2",  0.00, 0.30),  # the bloom that opens the film
    ("click-soft",     0.40, 0.22),  # cards assembling
    ("click-soft",     0.57, 0.22),
    ("click-soft",     0.74, 0.22),
    ("ping",           2.45, 0.50),  # #3 flips to waiting on you
    ("impact-bass-1",  5.25, 0.62),  # the question slams
    ("whoosh",         9.65, 0.32),  # into the wordmark
    # NOTE: the zoom-through used `whoosh-cinematic` — the long swirling one
    # Vaishak flagged as "not good for this". Replaced with the short, clean
    # whoosh. Do not put the cinematic swirl back.
    ("whoosh-short",  13.50, 0.34),  # zoom-through into the app
    ("impact-bass-2", 14.45, 0.42),  # the window lands
    ("click-soft",    15.70, 0.20),  # muster lamps
    ("click-soft",    15.93, 0.20),
    ("click-soft",    16.16, 0.20),
    ("whoosh-short",  18.90, 0.26),  # camera pushes to the pane
    ("click",         19.75, 0.34),  # cursor click
    ("typing",        19.95, 0.30),  # the command types
    ("pop",           21.00, 0.26),  # output lands
    ("chime",         24.60, 0.30),  # plain english flips on
    ("whoosh-short",  29.75, 0.30),  # palette springs open
    ("click-soft",    31.10, 0.24),  # selection steps
    ("click-soft",    31.70, 0.24),
    ("whoosh",        33.10, 0.32),  # timeline pushes up
    ("whoosh-short",  36.45, 0.26),  # into the annunciator
    ("pop",           36.70, 0.22),
    ("pop",           36.85, 0.22),
    ("pop",           37.00, 0.22),
    ("ping",          37.40, 0.34),  # the amber row asserts
    ("impact-bass-1", 41.40, 0.72),  # THE hard cut, the proof beat
    ("click-soft",    44.00, 0.24),  # the numbers arrive
    ("click-soft",    44.24, 0.24),
    ("riser",         46.30, 0.36),  # into the end card
    ("pop",           47.95, 0.30),  # the command pill
    ("click-soft",    49.70, 0.20),  # doctor checks reporting
    ("click-soft",    50.00, 0.20),
    ("click-soft",    50.30, 0.20),
    ("impact-bass-2", 51.85, 0.34),  # the close
]


def main():
    ins, filt = [], []

    # ---- music: three sections, crossfaded, then trimmed to length ---------
    for f in ("upA", "upB", "upA"):
        ins += ["-i", f"{A}/{f}.wav"]
    filt.append("[0:a][1:a]acrossfade=d=2.5:c1=tri:c2=tri[mA]")
    filt.append("[mA][2:a]acrossfade=d=2.5:c1=tri:c2=tri[mB]")
    filt.append(
        f"[mB]atrim=0:{TOTAL},asetpts=N/SR/TB,"
        f"afade=t=in:st=0:d=2.0,afade=t=out:st={TOTAL-3.0}:d=3.0,"
        "volume=0.30,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[music]"
    )

    idx = 3
    # ---- voice ------------------------------------------------------------
    vlabels = []
    for name, at in VOICE:
        ins += ["-i", f"{A}/{name}.wav"]
        ms = int(round(at * 1000))
        lbl = f"v{idx}"
        filt.append(
            f"[{idx}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,"
            f"adelay={ms}|{ms},volume=1.5[{lbl}]"
        )
        vlabels.append(f"[{lbl}]")
        idx += 1
    filt.append(
        "".join(vlabels) + f"amix=inputs={len(vlabels)}:normalize=0:dropout_transition=0,"
        f"apad,atrim=0:{TOTAL},asetpts=N/SR/TB[voice]"
    )

    # ---- sfx --------------------------------------------------------------
    slabels = []
    for name, at, gain in SFX:
        ins += ["-i", f"{A}/sfx/{name}.mp3"]
        ms = int(round(at * 1000))
        lbl = f"s{idx}"
        filt.append(
            f"[{idx}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,"
            f"adelay={ms}|{ms},volume={gain}[{lbl}]"
        )
        slabels.append(f"[{lbl}]")
        idx += 1
    filt.append(
        "".join(slabels) + f"amix=inputs={len(slabels)}:normalize=0:dropout_transition=0,"
        f"apad,atrim=0:{TOTAL},asetpts=N/SR/TB[sfx]"
    )

    # ---- duck the bed under the voice, then mix everything -----------------
    filt.append("[voice]asplit=2[vmix][vkey]")
    filt.append(
        "[music][vkey]sidechaincompress=threshold=0.035:ratio=7:attack=12:release=420[duck]"
    )
    filt.append(
        "[duck][vmix][sfx]amix=inputs=3:normalize=0:dropout_transition=0,"
        f"alimiter=limit=0.94,atrim=0:{TOTAL},asetpts=N/SR/TB[out]"
    )

    cmd = (
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"]
        + ins
        + ["-filter_complex", ";".join(filt), "-map", "[out]",
           "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "2", OUT]
    )
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.stderr.write(r.stderr[-4000:])
        sys.exit(1)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
