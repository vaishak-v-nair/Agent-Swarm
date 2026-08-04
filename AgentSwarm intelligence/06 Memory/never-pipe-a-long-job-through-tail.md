---
name: never-pipe-a-long-job-through-tail
description: "A background training run piped through `tail` showed an empty log, reported exit 0 after being killed mid-run, and silently stole CPU for 90 minutes — contaminating every benchmark taken meanwhile"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 9162a494-02c3-49ab-846a-4c3f8804c34d
  modified: 2026-08-04T10:29:51.502Z
---

I launched a 90-minute training job as:

    python train.py finetune --n 24000 … 2>&1 | grep -vE "…" | tail -60

Three failures compounded:

1. **`tail` buffers.** Nothing appeared in the log for the entire run, so there
   was no progress to check.
2. **`tail`'s exit status is what gets reported.** The python process was killed
   at step 500 of 1500. The task reported **"completed, exit code 0"**.
3. **I looked at the empty log, concluded the job was probably dead, and moved
   on** — while it kept consuming half the CPU for ninety more minutes.

**The damage:** every wall-clock benchmark I took during that window was
measured under contention and reported as clean. The "0.27 s/row/epoch"
calibration and the "74 minutes" training figure are both **upper bounds**, and
I published them as measurements. Accuracy numbers survived — contention changes
speed, not gradients — but any capacity planning off those timings is wrong.

**Why:** a pipeline's exit status is the *last* command's. Wrapping a job in
`tail`, `head`, `grep` or `sort` throws away both its output stream and its exit
code, which are the only two ways to know it is alive and the only two ways to
know it failed.

**How to apply:**
- Write a long job's output **straight to a file**, unbuffered (`python -u`),
  and read the file. Never through a filter.
- If a background job's log looks empty, **verify whether the process is alive**
  before assuming anything — check the process list, not the log.
- **Before benchmarking, confirm nothing else is running.** A timing number
  taken next to an unknown workload is not a measurement.
- Two jobs writing the same output path race; the loser's results vanish. Here
  the killed run would have silently overwritten the good one had it survived.

Same family as the project's existing rule about printing the refused quotes
instead of trusting the count, and [[a-schema-description-is-not-the-schema]]:
**check the thing itself, not a summary of it.** See [[agentswarm-dataset]].
