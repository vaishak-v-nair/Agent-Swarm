// Locators — what makes a receipt survive.
//
// The design's durability requirement: "source excerpt lines are
// content-addressed and copied into the store — receipts survive transcript
// rotation, compaction, and deletion."
//
// A locator therefore carries three things, not one:
//   1. WHERE it was      (session id + message uuid + file)
//   2. WHAT was there    (the excerpt itself, copied)
//   3. PROOF it is that  (sha256 of the excerpt, so tampering is detectable
//                         and the same excerpt is recognisable across files)
//
// Points 2 and 3 are why a receipt still resolves after Claude Code compacts
// the session away. Competitors that store only a path and a line number lose
// the receipt the moment the file rotates.

import crypto from 'node:crypto';

/** Stable content address for an excerpt. Whitespace-normalised so that
 *  re-emitted (resumed/compacted) copies of one message hash identically. */
export function excerptHash(text) {
  const normalised = String(text == null ? '' : text).replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim();
  return 'sha256:' + crypto.createHash('sha256').update(normalised, 'utf8').digest('hex');
}

/**
 * Cut a quotable excerpt around a span of interest.
 *
 * Extraction reads full messages, but a *receipt* should be the few lines a
 * human needs to see to believe the card. Cuts on line boundaries so a quote
 * is never half a sentence.
 */
export function cutExcerpt(text, { match = '', maxChars = 600 } = {}) {
  const src = String(text || '');
  if (src.length <= maxChars) return src.trim();

  const lines = src.split('\n');
  let centre = 0;
  if (match) {
    const idx = src.indexOf(match);
    if (idx >= 0) centre = src.slice(0, idx).split('\n').length - 1;
  }

  let lo = centre;
  let hi = centre;
  let size = lines[centre] ? lines[centre].length : 0;
  while (size < maxChars && (lo > 0 || hi < lines.length - 1)) {
    if (hi < lines.length - 1) {
      const next = lines[hi + 1];
      if (size + next.length + 1 > maxChars) break;
      hi++; size += next.length + 1;
    }
    if (lo > 0) {
      const prev = lines[lo - 1];
      if (size + prev.length + 1 > maxChars) break;
      lo--; size += prev.length + 1;
    }
    if (hi >= lines.length - 1 && lo <= 0) break;
  }
  return lines.slice(lo, hi + 1).join('\n').trim();
}

/**
 * Build the transcript half of a receipt.
 *
 * Every published card must carry this. The commit half comes from
 * `commit.js` and is allowed to be absent — a card with an uncertain SHA ships
 * transcript-only rather than a wrong SHA.
 *
 * @param {import('./transcript.js').Message} message
 */
export function locate(message, { match = '', maxChars = 600 } = {}) {
  const excerpt = cutExcerpt(message.text, { match, maxChars });
  return {
    sessionId: message.sessionId,
    messageUuid: message.uuid,
    timestamp: message.timestamp,
    cwd: message.cwd,
    file: message.file,
    excerpt,
    excerptHash: excerptHash(excerpt),
  };
}

/**
 * Verify a stored receipt against the text it claims to quote.
 * "A wrong receipt is worse than no answer" is a gate, so the store must be
 * able to prove a receipt still says what it said.
 */
export function verifyExcerpt(locator, text) {
  return !!locator && locator.excerptHash === excerptHash(text);
}
