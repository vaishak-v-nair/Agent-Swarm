// recall-core — the shared organs.
//
// Gate 1 (2026-07-30) found Recall and PRAXIS to be separate products with
// overlapping plumbing, and ruled that the plumbing be extracted rather than
// rebuilt. This package is that extraction. It is consumed by Recall M1 and by
// AgentSwarm M2, which is why it lives on its own and depends on nothing.
//
// Boundary, binding (from the audit): PRAXIS proves what the AI did and never
// becomes a search/QA engine; Recall remembers why and never signs or judges.
// Nothing in this package signs, judges, extracts meaning, or answers — it
// reads, addresses, redacts, and joins. Meaning lives one layer up.

export {
  SCHEMA_FIELDS,
  projectsRoot,
  listTranscripts,
  readMessages,
  parseMessages,
  cleanUserText,
  dedupeMessages,
} from './transcript.js';

export { excerptHash, cutExcerpt, locate, verifyExcerpt } from './locator.js';

export { redact, redactDeep } from './redact.js';

export {
  resultText,
  commitsFromToolResult,
  effectiveRepo,
  authoredCommits,
  joinCommit,
} from './commit.js';
