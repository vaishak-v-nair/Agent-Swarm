import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMessages, cleanUserText, dedupeMessages,
  excerptHash, cutExcerpt, locate, verifyExcerpt,
  redact, redactDeep,
  commitsFromToolResult, authoredCommits, joinCommit, effectiveRepo,
} from '../src/index.js';

// ---------------------------------------------------------------- fixtures
// Shapes copied from real transcripts (redacted). Version-pinned on purpose:
// if Claude Code changes its JSONL, these fail loudly here instead of silently
// producing an empty store.
const line = (o) => JSON.stringify(o);

const ASK = line({
  type: 'user', uuid: 'u1', sessionId: 's1', cwd: 'E:\\Ingot', timestamp: '2026-07-28T10:00:00.000Z',
  message: { role: 'user', content: [{ type: 'text', text: 'why did the scan hang?' }] },
});
const SAY = line({
  type: 'assistant', uuid: 'a1', sessionId: 's1', cwd: 'E:\\Ingot', timestamp: '2026-07-28T10:00:20.000Z',
  message: {
    role: 'assistant',
    content: [
      { type: 'text', text: 'Root cause: GCM still runs first.\nReset the helper list, do not append.' },
      { type: 'tool_use', id: 't1', name: 'Bash', input: { command: "git add -A && git commit -m 'fix'" } },
    ],
  },
});
const RESULT = line({
  type: 'user', uuid: 'u2', sessionId: 's1', cwd: 'E:\\Ingot', timestamp: '2026-07-28T10:00:25.000Z',
  message: {
    role: 'user',
    content: [{ type: 'tool_result', tool_use_id: 't1', content: '[main 08516c9] fix\n 4 files changed' }],
  },
});
const SIDECHAIN = line({
  type: 'assistant', uuid: 'x1', sessionId: 's1', isSidechain: true, timestamp: '2026-07-28T10:00:30.000Z',
  message: { role: 'assistant', content: [{ type: 'text', text: 'subagent chatter' }] },
});

// ------------------------------------------------------------- transcript
test('parses messages and keeps them addressable', () => {
  const msgs = [...parseMessages([ASK, SAY, RESULT].join('\n'))];
  assert.equal(msgs.length, 3);
  assert.equal(msgs[0].role, 'user');
  assert.equal(msgs[0].uuid, 'u1');
  assert.equal(msgs[0].sessionId, 's1');
  assert.match(msgs[1].text, /Root cause/);
  assert.equal(msgs[1].toolUses[0].name, 'Bash');
  assert.equal(msgs[2].toolResults[0].toolUseId, 't1');
});

test('sub-agent sidechains are not the user history', () => {
  const msgs = [...parseMessages([ASK, SIDECHAIN].join('\n'))];
  assert.equal(msgs.length, 1);
});

test('a half-written tail line does not abort the parse', () => {
  const msgs = [...parseMessages([ASK, '{"type":"assis'].join('\n'))];
  assert.equal(msgs.length, 1);
});

test('hook noise and slash wrappers are stripped from the ask', () => {
  assert.equal(cleanUserText('<system-reminder>noise</system-reminder> real ask'), 'real ask');
  assert.equal(cleanUserText('<command-name>/ship</command-name>'), '/ship');
  assert.equal(cleanUserText('<local-command-stdout>out</local-command-stdout>'), '');
});

test('resumed sessions do not double-count', () => {
  const once = [...parseMessages([ASK, SAY].join('\n'))];
  const replayed = [...parseMessages([ASK, SAY].join('\n'))].map((m) => ({ ...m, uuid: m.uuid + '-r' }));
  const seen = new Set();
  const a = dedupeMessages(once, seen);
  const b = dedupeMessages(replayed, seen);
  assert.equal(a.length, 2);
  assert.equal(b.length, 0, 'a replayed session must add nothing');
});

// ---------------------------------------------------------------- locator
test('excerpt hash is stable across whitespace churn', () => {
  assert.equal(excerptHash('a\r\nb  \n'), excerptHash('a\nb'));
});

test('excerpts cut on line boundaries around the match', () => {
  const text = Array.from({ length: 40 }, (_, i) => `line ${i}`).join('\n');
  const cut = cutExcerpt(text, { match: 'line 20', maxChars: 60 });
  assert.match(cut, /line 20/);
  assert.ok(!cut.startsWith('ine'), 'must not slice mid-line');
  assert.ok(cut.length <= 60);
});

test('a receipt can prove it still says what it said', () => {
  const [, say] = [...parseMessages([ASK, SAY].join('\n'))];
  const loc = locate(say, { match: 'Root cause' });
  assert.equal(loc.messageUuid, 'a1');
  assert.ok(loc.excerpt.length > 0);
  assert.ok(verifyExcerpt(loc, loc.excerpt));
  assert.ok(!verifyExcerpt(loc, loc.excerpt + ' tampered'));
});

// ---------------------------------------------------------------- redaction
test('secrets never reach an LLM call', () => {
  assert.match(redact('key sk-ant-abcdefghijklmnop0123'), /REDACTED_ANTHROPIC_KEY/);
  assert.match(redact('postgres://user:hunter2@host/db'), /\[REDACTED\]:\[REDACTED\]@/);
  assert.ok(!redact('AWS AKIAIOSFODNN7EXAMPLE').includes('AKIAIOSFODNN7EXAMPLE'));
});

test('the export path scrubs nested excerpts too', () => {
  const card = { title: 'ok', receipt: { excerpt: 'token ghp_abcdefghijklmnopqrst1234' } };
  assert.match(redactDeep(card).receipt.excerpt, /REDACTED_GITHUB_TOKEN/);
});

// ----------------------------------------------------------------- commit
test('a commit line is authorship', () => {
  const { authored } = commitsFromToolResult(
    "git add -A && git commit -m 'x'",
    '[main 08516c9] chore(pkg): rename\n 4 files changed',
  );
  assert.equal(authored.length, 1);
  assert.equal(authored[0].sha, '08516c9');
  assert.equal(authored[0].branch, 'main');
  assert.equal(authored[0].confidence, 'certain');
});

test('a root-commit line still parses', () => {
  const { authored } = commitsFromToolResult(
    'git commit -m init',
    '[main (root-commit) f6dc9d8] Initial commit',
  );
  assert.equal(authored[0].sha, 'f6dc9d8');
});

// This is the test the whole provenance claim rests on. `git log` output is the
// MORE COMMON shape in the corpus (321 vs 165). Citing it as authorship would
// attach an unrelated, usually older, commit to a card.
test('git log output is never authorship', () => {
  const out = '5c541bc docs: the throughput claim was a kernel figure\n5d03ba2 chore(repo): ignore secrets';
  const { authored, mentioned } = commitsFromToolResult('git log --oneline -5', out);
  assert.equal(authored.length, 0, 'reading history is not authoring it');
  assert.deepEqual(mentioned.sort(), ['5c541bc', '5d03ba2']);
});

test('non-git commands yield nothing', () => {
  const { authored } = commitsFromToolResult('npm test', '[main 08516c9] not a commit');
  assert.equal(authored.length, 0);
});

test('authored commits carry the locator of the message that made them', () => {
  const msgs = [...parseMessages([ASK, SAY, RESULT].join('\n'))];
  const found = authoredCommits(msgs);
  assert.equal(found.length, 1);
  assert.equal(found[0].sha, '08516c9');
  assert.equal(found[0].sessionId, 's1');
  assert.equal(found[0].messageUuid, 'u2');
  assert.equal(found[0].cwd, 'E:\\Ingot');
});

test('a card joins the commit that FOLLOWS it, never the one before', () => {
  const commits = [
    { sha: 'aaaaaaa', branch: 'main', confidence: 'certain', timestamp: '2026-07-28T09:00:00.000Z', messageUuid: 'm0' },
    { sha: 'bbbbbbb', branch: 'main', confidence: 'certain', timestamp: '2026-07-28T11:00:00.000Z', messageUuid: 'm1' },
  ];
  const at = Date.parse('2026-07-28T10:00:00.000Z');
  assert.equal(joinCommit(commits, at).sha, 'bbbbbbb');
});

test('no commit in the window ships transcript-only, never a wrong SHA', () => {
  const commits = [
    { sha: 'aaaaaaa', branch: 'main', confidence: 'certain', timestamp: '2026-07-20T09:00:00.000Z', messageUuid: 'm0' },
  ];
  const at = Date.parse('2026-07-28T10:00:00.000Z');
  assert.equal(joinCommit(commits, at), null);
});
