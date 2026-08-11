// The flywheel — every judgment becomes a labeled training row.
//
// Until now the judge read a candidate, decided, and THREW THE DECISION AWAY
// after storing the card. But each decision is exactly one row of the
// AgentSwarm dataset's task shape: given a passage, return a verbatim span or
// abstain. The 416k public rows taught that shape; these rows teach OUR
// distribution — real transcripts, real tool output, real developer
// vocabulary. Nobody else has this data, because it is exhaust from this
// product's own runs. That asymmetry compounds every time the engine runs,
// which is the point of P9 Lever 1.
//
// Two rules:
//   1. Rows are redacted BEFORE writing — the file must be safe to feed to a
//      training run on someone else's GPU, so no secret may ever enter it.
//   2. Append-only JSONL beside the store (RECALL_HOME), not in the repo.
//      It is private exhaust. `humanVerdict` stays null until a human fills
//      it during the 50-card read; no machine writes that field.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { redact } from '../../recall-core/src/index.js';

export function flywheelPath() {
  const home = process.env.RECALL_HOME || path.join(os.homedir(), '.recall');
  return path.join(home, 'flywheel.jsonl');
}

/**
 * Append one row per judged candidate. `cards` and `rejected` come straight
 * from judgeBatch; every candidate lands in one of them, and the row records
 * which — plus the accepted quote, or the attempted quote on a faithfulness
 * refusal (that distinction is what separates a fabricating model from an
 * over-strict gate, and it must survive into the training data).
 *
 * Returns the number of rows written.
 */
export function recordJudgments({
  candidates, cards = [], rejected = [], model, promptVersion,
  file = flywheelPath(),
}) {
  const verdicts = new Map();
  for (const c of cards) verdicts.set(c.messageUuid, { accepted: true, card: c });
  for (const r of rejected) {
    if (r.id && !verdicts.has(r.id)) verdicts.set(r.id, { accepted: false, rej: r });
  }

  const lines = [];
  for (const cand of candidates) {
    const v = verdicts.get(cand.messageUuid);
    if (!v) continue; // a whole-batch error carries no per-candidate verdict
    lines.push(JSON.stringify({
      v: 1,
      recordedAt: new Date().toISOString(),
      sessionId: cand.sessionId,
      messageUuid: cand.messageUuid,
      model: model || null,
      promptVersion: promptVersion || null,
      generator: cand.generator || null,
      context: redact(String(cand.text || '')),
      trigger: cand.trigger ? redact(String(cand.trigger)) : null,
      accepted: v.accepted,
      quote: v.accepted ? v.card.quote : (v.rej.attemptedQuote || null),
      reason: v.accepted ? null : (v.rej.reason || 'rejected'),
      cardType: v.accepted ? v.card.type : null,
      humanVerdict: null,
    }));
  }
  if (!lines.length) return 0;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, lines.join('\n') + '\n', 'utf8');
  return lines.length;
}
