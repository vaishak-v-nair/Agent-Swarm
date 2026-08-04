// The session -> commit join.
//
// This is the load-bearing half of Recall's surviving claim: "every card cited
// to the exact transcript line AND the commit SHA". PRAXIS had a time-window
// heuristic; this module reads the SHA out of the tool result that produced it.
//
// The shapes below are not guesses. They were measured over 101 real
// transcripts (15,628 tool results, 1,177 git commands) before this file was
// written:
//
//   commit-line   165   "[main 08516c9] chore(pkg): rename to ingot-scan"
//   log-oneline   321   "5c541bc docs: the throughput claim was a kernel figure"
//   generic-40     19
//   rev-parse       5
//
// The counts hide the important distinction, and it is the whole design:
//
//   A commit LINE proves this session AUTHORED that commit.
//   A log ONELINE proves only that the session READ history.
//
// `git log` is the more common shape, and using it as a citation would attach
// somebody else's commit — usually an older one — to a card that had nothing
// to do with it. The design rule is "a card with an uncertain SHA ships
// transcript-only rather than a wrong SHA", so log output never yields an
// authorship claim here. It is kept only as `mentioned`, which callers may use
// for enrichment and must never render as "decided here".

/** `[main 08516c9] message` / `[main (root-commit) 1a2b3c4] message` */
const COMMIT_LINE = /\[([^\]\s]+)(?:\s+\(root-commit\))?\s+([0-9a-f]{7,40})\]/g;

/** A bare 40-char SHA on its own line — `git rev-parse HEAD`. */
const REV_PARSE_LINE = /^\s*([0-9a-f]{40})\s*$/gm;

/** `5c541bc docs: ...` at line start — `git log --oneline`. Read, not authored. */
const LOG_ONELINE = /^([0-9a-f]{7,12})\s+\S/gm;

const IS_COMMIT_CMD = /\bgit\b[\s\S]*\bcommit\b/;
const IS_REVPARSE_CMD = /\bgit\b[\s\S]*\brev-parse\b/;
const IS_GIT_CMD = /(^|[\s;&|(])git\b/;

/** A leading `cd <path>` / `Set-Location <path>` retargets the whole command. */
const LEADING_CD = /^\s*(?:cd|Set-Location)\s+(?:"([^"]+)"|'([^']+)'|(\S+))/i;
/** `git -C <path> …` retargets just that git invocation. */
const GIT_DASH_C = /\bgit\s+-C\s+(?:"([^"]+)"|'([^']+)'|(\S+))/i;

/**
 * Which repository did this command actually commit to?
 *
 * Found by running against the real corpus, not by imagining it: a session
 * whose recorded `cwd` is `E:\agent-swarm` ran
 * `cd "/e/faceless-video-pipeline" && git add … && git commit`, so the SHA
 * belongs to a different repo than the session's. The transcript's `cwd` is
 * where the SESSION started, not where the COMMAND ran. Attributing by session
 * cwd would cite the wrong repository — a wrong receipt, which the design
 * ranks worse than no answer.
 */
export function effectiveRepo(command, sessionCwd) {
  const cmd = String(command || '');
  const g = cmd.match(GIT_DASH_C);
  if (g) return trimPath(g[1] || g[2] || g[3]);
  const c = cmd.match(LEADING_CD);
  if (c) return trimPath(c[1] || c[2] || c[3]);
  return sessionCwd || null;
}

/**
 * An unquoted path runs up against the shell separator that follows it —
 * `Set-Location E:\PA; git commit` captures `E:\PA;`. Caught by the test, not
 * by inspection. Strip trailing separators and punctuation; keep the path.
 */
function trimPath(p) {
  return String(p || '').replace(/[;&|,]+$/, '') || null;
}

/** Normalise a tool_result body, which may be a string or content blocks. */
export function resultText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((c) => (c && typeof c.text === 'string' ? c.text : '')).join('\n');
  }
  return '';
}

/**
 * Extract commit evidence from one command + its output.
 *
 * @returns {{authored: Array<{sha,branch,confidence}>, mentioned: string[]}}
 *   `authored` — this session created these commits. Safe to cite.
 *   `mentioned` — SHAs that merely appeared. NEVER cite as authorship.
 */
export function commitsFromToolResult(command, output) {
  const cmd = String(command || '');
  const out = String(output || '');
  const authored = [];
  const mentioned = new Set();

  if (!IS_GIT_CMD.test(cmd)) return { authored, mentioned: [] };

  // A commit line is only authorship evidence when the command actually ran a
  // commit. `git show` and `git log --format` can both print bracketed text.
  if (IS_COMMIT_CMD.test(cmd)) {
    for (const m of out.matchAll(COMMIT_LINE)) {
      authored.push({ branch: m[1], sha: m[2], confidence: 'certain' });
    }
  }

  // `git rev-parse HEAD` immediately identifies the current commit. Treated as
  // authorship only when the same command also committed (`commit && rev-parse`),
  // otherwise the session is just asking where it is.
  if (IS_REVPARSE_CMD.test(cmd) && IS_COMMIT_CMD.test(cmd)) {
    for (const m of out.matchAll(REV_PARSE_LINE)) {
      if (!authored.some((a) => m[1].startsWith(a.sha))) {
        authored.push({ branch: null, sha: m[1], confidence: 'high' });
      }
    }
  }

  for (const m of out.matchAll(LOG_ONELINE)) mentioned.add(m[1]);
  for (const m of out.matchAll(REV_PARSE_LINE)) mentioned.add(m[1]);
  for (const a of authored) mentioned.delete(a.sha);

  return { authored, mentioned: [...mentioned] };
}

/**
 * Walk a parsed session and return every commit it authored, in order, each
 * carrying the locator of the message that produced it.
 *
 * @param {Iterable<import('./transcript.js').Message>} messages
 */
export function authoredCommits(messages) {
  const commandById = new Map();
  const found = [];

  for (const msg of messages) {
    for (const t of msg.toolUses) {
      if (t.name === 'Bash' || t.name === 'PowerShell') {
        commandById.set(t.id, String((t.input && t.input.command) || ''));
      }
    }
    for (const r of msg.toolResults) {
      const command = commandById.get(r.toolUseId);
      if (!command) continue;
      const { authored } = commitsFromToolResult(command, r.text);
      for (const a of authored) {
        found.push({
          ...a,
          command,
          sessionId: msg.sessionId,
          messageUuid: msg.uuid,
          timestamp: msg.timestamp,
          cwd: msg.cwd,
          // The repo the SHA actually lives in — not necessarily the session's.
          repo: effectiveRepo(command, msg.cwd),
        });
      }
    }
  }
  return found;
}

/**
 * Attach a commit to a moment in the session.
 *
 * The rule the design fixes: the commit that *follows* a piece of work is the
 * one that contains it. So a card at time T joins the first authored commit at
 * or after T, within `windowMs`. If none exists, the card ships transcript-only
 * — never the nearest commit in either direction, which is how time-window
 * heuristics attach the wrong SHA.
 *
 * @returns {{sha,branch,confidence,messageUuid}|null}
 */
export function joinCommit(commits, timestampMs, { windowMs = 2 * 60 * 60 * 1000 } = {}) {
  if (!Number.isFinite(timestampMs)) return null;
  let best = null;
  for (const c of commits) {
    const t = Date.parse(c.timestamp);
    if (!Number.isFinite(t) || t < timestampMs) continue;
    if (t - timestampMs > windowMs) continue;
    if (!best || t < Date.parse(best.timestamp)) best = c;
  }
  if (!best) return null;
  return {
    sha: best.sha,
    branch: best.branch,
    // Certainty of the SHA's *parse* is not certainty of the *join*: we know
    // this session made this commit, and that the work preceded it, which is
    // strong but not proof the card's content is in that diff.
    confidence: best.confidence === 'certain' ? 'high' : 'medium',
    messageUuid: best.messageUuid,
  };
}
