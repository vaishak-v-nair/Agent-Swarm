/* The decision that matters: does this pane need a human?
 *
 * Kept apart from the DOM deliberately. This is the logic that decides whether
 * to interrupt someone, and logic that decides when to interrupt someone should
 * be testable without a window. Everything here is a pure function of numbers.
 *
 * Nothing scrapes the terminal for prompt text. State comes from two signals we
 * hold honestly:
 *
 *   · the bell — Claude Code asking for you by name
 *   · an outstanding tool call combined with a silent terminal
 *
 * The second is the useful one. A tool that is running produces output; a tool
 * that was called, has produced nothing, and is not finishing is a tool waiting
 * on a person. That inference needs to know nothing about how the prompt is
 * drawn, so it survives Claude Code redrawing it.
 */

export const QUIET_MS = 2000; // below the throughput floor this long = not streaming
export const STUCK_MS = 8000; // outstanding tool + no real output this long = it's you

/* These are defaults, not law. They were chosen by watching one machine for
 * forty seconds, and a threshold that decides when to interrupt someone should
 * be changeable by the person it interrupts — `tune` comes from
 * .agentswarm/settings.json. See M7. */

/* On "quiet": it means *below a throughput floor*, not "no bytes at all".
 *
 * Claude Code's interface repaints while it sits there — a spinner, a status
 * line, a redrawn input box. Treating any byte as liveness made a pane flip
 * between working and idle every couple of seconds, and worse, a permission
 * prompt that animates would have kept the stuck detector from ever firing. The
 * thing being asked for is *progress*, and progress has volume. */

export function fmt(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m`;
}

/** The tool that has been outstanding longest, if any. */
export function oldestPending(pending) {
  let best = null;
  for (const t of pending.values()) if (!best || t.at < best.at) best = t;
  return best;
}

/**
 * @param p    { alive, born, quietSince, lastCardAt, lastKind, bellAt, own, pending:Map }
 *             quietSince is 0 while output is above the throughput floor, else
 *             the moment it dropped below.
 * @param now  epoch ms
 * @returns    { key: 'needs'|'work'|'done'|'idle'|'ended', label, since }
 */
export function paneState(p, now, tune = {}) {
  if (!p.alive) return { key: 'ended', label: 'ended', since: 0 };

  const quietMs = tune.quiet_ms ?? QUIET_MS;
  const stuckMs = tune.stuck_ms ?? STUCK_MS;
  const quiet = p.quietSince ? now - p.quietSince : 0;
  const pend = oldestPending(p.pending);

  // A bell outranks everything. It is not an inference — it is a request.
  if (p.bellAt) return { key: 'needs', label: 'needs you', since: now - p.bellAt };

  // The tool signal is only meaningful when the transcript is this pane's OWN
  // session. While merely catching up on an earlier one, its outstanding calls
  // describe somebody else's work — pairing them with this pane's silence
  // manufactures a confident false alarm. Caught exactly that way in testing:
  // a pane reported "waiting · Bash" for a Bash call in a different session.
  if (pend && p.own) {
    const waiting = now - pend.at;
    // Called, silent, and not finishing. On this machine that means a prompt.
    if (quiet > stuckMs) return { key: 'needs', label: `waiting · ${pend.name}`, since: waiting };
    return { key: 'work', label: pend.name, since: waiting };
  }

  if (quiet < quietMs) return { key: 'work', label: 'working', since: 0 };

  // Claude spoke last and nothing has moved since: the turn is over, and the
  // next move is yours. Distinct from 'needs' — nobody is blocked, but it is
  // finished, and a finished agent you haven't noticed is also wasted time.
  if (p.own && p.lastKind === 'claude') return { key: 'done', label: 'your turn', since: now - p.lastCardAt };

  return { key: 'idle', label: 'idle', since: quiet };
}
