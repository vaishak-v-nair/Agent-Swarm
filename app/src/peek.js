/* Is this line worth showing on a folded pane?
 *
 * A pane in the rail showed "8" — the tail of some output, carrying nothing.
 * That is worse than showing nothing at all, because it looks like information.
 * The card is supposed to be a glance at the work; a fragment makes it a glance
 * at noise.
 *
 * Kept in its own module so it can be tested from a file. The same regex was
 * reported broken twice by test fixtures typed through a shell, where the
 * backslashes never survived to reach the matcher.
 */

/** A bare shell prompt: `PS E:\project>`, `C:\Users\me>`, `/home/me $`. */
const PROMPT = /^(PS\s+)?([A-Za-z]:[\\/]|[\\/~])\S*\s*[>$#%]\s*$/;

/** At least three letters or digits in a row's worth of actual content.
 *
 *  The first version of this only rejected ASCII punctuation, so a folded pane
 *  went straight from showing "8" to showing "─────────" — the border of
 *  Claude's own interface. Same failure wearing a different character set:
 *  long enough to look like a line of output, carrying nothing. Requiring
 *  letters covers box drawing, spinners and rules without naming them all. */
const WORDS = /[\p{L}\p{N}]/gu;

export function worthShowing(line) {
  const l = (line || '').trim();
  if (l.length < 6) return false;   // "abc", "8", "ok" — too little to read
  if ((l.match(WORDS) || []).length < 3) return false;
  if (PROMPT.test(l)) return false;
  return true;
}

/** The most recent line of a chunk that is actually worth showing. */
export function lastMeaningful(lines) {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (worthShowing(lines[i])) return lines[i].trim();
  }
  return null;
}
