/* Ordering and finding — the two pieces of M4 that are pure logic, and so are
 * kept where they can be tested without a window.
 *
 * "It places everything in order which claude CLI lacks" was the original
 * complaint. Ordering across sessions is the answer, and getting it subtly wrong
 * is invisible: the timeline still looks plausible while telling you events
 * happened in an order they did not.
 */

/** Newest cards are added at the end, so the feed stays bounded. */
export const FEED_MAX = 2000;

/**
 * Insert into an array kept sorted ascending by `.at`, and hold it to FEED_MAX.
 *
 * Cards normally arrive in order, so this walks back from the end rather than
 * re-sorting — O(1) in the common case. Out-of-order arrivals are real, though:
 * a pane that attaches late replays history while another streams live, and one
 * filesystem poll can deliver a whole batch at once.
 *
 * Equal timestamps keep insertion order. Claude Code stamps to the second, so
 * ties are frequent, and a stable tie-break is what stops a tool call from
 * appearing above the message that requested it.
 */
export function insertOrdered(feed, card, max = FEED_MAX) {
  let i = feed.length;
  while (i > 0 && feed[i - 1].at > card.at) i--;
  feed.splice(i, 0, card);
  while (feed.length > max) feed.shift();
  return feed;
}

/**
 * Subsequence match: "mrn" finds "morning". Returns -Infinity for no match, and
 * a higher (less negative) score for a better one.
 *
 * The sentinel is -Infinity rather than -1 on purpose: a real match scores
 * negatively too — "mrn" against "swarm  morning" is -8 — so any finite
 * sentinel is also a reachable score, and callers filtering on it silently drop
 * good matches. That exact bug was caught by the test below.
 *
 * Ranking is by where the match starts and how tightly it holds together, so
 * typing a prefix puts the obvious answer first. An empty query scores every
 * item equally, which leaves the list in its authored order — recipes before
 * panes before views, most-used first.
 */
export function score(text, q) {
  if (!q) return 0;
  const t = text.toLowerCase();
  let i = 0, first = -1, last = -1, gaps = 0;
  for (const ch of q.toLowerCase()) {
    const j = t.indexOf(ch, i);
    if (j < 0) return -Infinity;
    if (first < 0) first = j;
    if (last >= 0) gaps += j - last - 1;
    last = j;
    i = j + 1;
  }
  return -(first + gaps);
}
