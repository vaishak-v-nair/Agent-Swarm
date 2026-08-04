// Candidate generation — stage 1 of extraction.
//
// This module does NOT decide what a card is. It cannot. The signal probe
// (R1, 2026-07-30) measured a keyword-only extractor and found it:
//
//   * ~68% precision on decisions, **13% on abandonment**
//   * INVERTS ON NEGATION — "nothing abandoned" and "right not to abandon
//     PRAXIS" both scored as abandonment
//   * blind to the best cards in the corpus: "Root cause: venv on Python
//     3.15.0a8 — no prebuilt wheels exist yet" contains no trigger vocabulary
//     at all
//
// So the rule this file obeys: **regex is a candidate generator, never the
// final layer.** Its job is recall, not precision — hand the LLM a shortlist
// small enough to afford and wide enough to contain the good cards. Judging
// happens downstream. Anything here that starts *rejecting* candidates on
// keywords is the bug the probe warned about.
//
// Two generators, because the probe found they surface different things:
//
//   1. ERROR->RETRY windows. The highest-value cards live here and are usually
//      keyword-free. A tool result fails; what the assistant says next is where
//      the gotcha gets stated.
//   2. VOCABULARY hits. Cheap, catches stated decisions the first generator
//      misses. Over-fires badly; that is acceptable and expected.

import { redact } from '../../recall-core/src/index.js';

/** Failure in tool output. Broad on purpose — recall over precision. */
const ERROR_SIGNAL =
  /\b(error|exception|traceback|failed|failure|cannot|can't|unable to|not found|refused|denied|timed out|timeout|panic|fatal|ENOENT|EACCES|ECONNREFUSED|MODULE_NOT_FOUND|AssertionError|SyntaxError|non-zero exit|exit code [1-9])\b/i;

/**
 * Vocabulary that *often* accompanies a card. Deliberately NOT used to reject.
 * Kept explicit so the next reader sees exactly how weak it is.
 */
const VOCAB = {
  gotcha:
    /\b(root cause|turns out|the problem (?:was|is)|gotcha|caveat|the catch|silently|actually (?:does|did|is)|does not actually|doesn'?t actually|beware|footgun|surprising(?:ly)?|undocumented|only works if|breaks when)\b/i,
  decision:
    /\b(decided|decision|we(?:'| a)?ll go with|going with|chose|choosing|instead of|rather than|the approach is|settled on|opted for)\b/i,
  abandonment:
    /\b(abandon(?:ed|ing)?|gave up|scrapp?(?:ed|ing)|reverted|rolled back|backed out|dead end|didn'?t work|not going to work|throw(?:ing)? away)\b/i,
};

const MIN_PROSE = 40; // shorter than this cannot carry mechanism + consequence

/**
 * @typedef {object} Candidate
 * @property {'error-retry'|'vocabulary'} generator  why it was surfaced
 * @property {string[]} hints    vocabulary buckets that fired (NEVER a verdict)
 * @property {string} text       FULL message text — probe finding (d)
 * @property {string} trigger    the failing output, when generator is error-retry
 * @property {string} sessionId
 * @property {string} messageUuid
 * @property {string} timestamp
 * @property {string} cwd
 */

/** Which vocabulary buckets fired. A hint for the judge, not a label. */
export function vocabularyHints(text) {
  const hits = [];
  for (const [name, re] of Object.entries(VOCAB)) if (re.test(text)) hits.push(name);
  return hits;
}

/** Does this tool output look like a failure? */
export function looksLikeError(text) {
  return ERROR_SIGNAL.test(String(text || ''));
}

/**
 * Generate candidates from one session's messages.
 *
 * Messages must already be deduped — probe finding (e): resumed and compacted
 * sessions replay history, and both generators double-count it.
 *
 * @param {Array} messages  from recall-core `readMessages` + `dedupeMessages`
 * @param {{lookahead?: number}} opts  assistant messages to inspect after a failure
 */
export function candidatesFrom(messages, { lookahead = 3 } = {}) {
  const out = [];
  const claimed = new Set(); // one candidate per message; error-retry wins

  // ---- generator 1: error -> retry ---------------------------------------
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const failing = m.toolResults.find((r) => looksLikeError(r.text));
    if (!failing) continue;

    for (let j = i + 1, seen = 0; j < messages.length && seen < lookahead; j++) {
      const next = messages[j];
      if (next.role !== 'assistant') continue;
      seen++;
      if (!next.text || next.text.length < MIN_PROSE) continue;
      if (claimed.has(next.uuid)) continue;
      claimed.add(next.uuid);
      // The trigger's OWN message id travels with the candidate. A card may
      // legitimately quote the error text, and that quote's receipt resolves to
      // the message that produced the error, not to the reply.
      out.push(make('error-retry', next, failing.text, m.uuid));
    }
  }

  // ---- generator 2: vocabulary -------------------------------------------
  for (const m of messages) {
    if (m.role !== 'assistant' || !m.text || m.text.length < MIN_PROSE) continue;
    if (claimed.has(m.uuid)) continue;
    if (!vocabularyHints(m.text).length) continue;
    claimed.add(m.uuid);
    out.push(make('vocabulary', m, ''));
  }

  return out.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
}

function make(generator, msg, trigger, triggerUuid = '') {
  return {
    generator,
    hints: vocabularyHints(msg.text),
    // FULL message. Truncation destroyed otherwise-good cards in the probe.
    text: msg.text,
    // Trigger is evidence for the judge; capped because a stack trace can be
    // enormous and the judge only needs to see that it failed and roughly how.
    trigger: trigger ? String(trigger).slice(0, 1200) : '',
    triggerUuid,
    sessionId: msg.sessionId,
    messageUuid: msg.uuid,
    timestamp: msg.timestamp,
    cwd: msg.cwd,
  };
}

/**
 * Everything the judge is allowed to see, secrets stripped.
 *
 * The design requires redaction BEFORE any LLM call, and that transcript text
 * be fenced as DATA so an instruction embedded in a transcript cannot steer the
 * extractor. Both happen here so no caller can forget.
 */
export function toPrompt(candidate) {
  const fence = '<<<TRANSCRIPT_DATA>>>';
  const body = redact(candidate.text);
  const trigger = candidate.trigger ? redact(candidate.trigger) : '';
  return {
    meta: {
      generator: candidate.generator,
      hints: candidate.hints,
      sessionId: candidate.sessionId,
      messageUuid: candidate.messageUuid,
      timestamp: candidate.timestamp,
    },
    // The judge is told: everything between the fences is data to be analysed,
    // never instructions to follow.
    text: `${fence}\n${trigger ? `[failing output]\n${trigger}\n\n[what was said next]\n` : ''}${body}\n${fence}`,
  };
}
