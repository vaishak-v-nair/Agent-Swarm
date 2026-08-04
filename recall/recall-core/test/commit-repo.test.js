// Which repository does a cited SHA actually belong to?
//
// These two cases were not imagined. The first came out of running the parser
// over the real corpus; the second came out of this test file failing.

import test from 'node:test';
import assert from 'node:assert/strict';
import { effectiveRepo } from '../src/index.js';

// A session whose recorded cwd was E:\agent-swarm ran
// `cd "/e/faceless-video-pipeline" && git add … && git commit`.
// The transcript's `cwd` is where the SESSION started, not where the COMMAND
// ran, so attributing the SHA by session cwd cites the wrong repository.
test('the commit belongs to the repo the command moved to', () => {
  const SESSION = String.raw`E:\agent-swarm`;

  assert.equal(
    effectiveRepo('cd "/e/faceless-video-pipeline" && git add -A && git commit -m x', SESSION),
    '/e/faceless-video-pipeline',
  );
  assert.equal(effectiveRepo('git -C ingot commit -m x', SESSION), 'ingot');
  assert.equal(effectiveRepo("cd '/e/space/gravity-posterior' && git commit -m x", SESSION), '/e/space/gravity-posterior');

  // No redirection at all: the session's own cwd is the right answer.
  assert.equal(effectiveRepo('git commit -m x', SESSION), SESSION);
  // Not a git command, but the helper is total — callers gate on IS_GIT_CMD.
  assert.equal(effectiveRepo('npm test', SESSION), SESSION);
});

// PowerShell separates statements with `;`, so an unquoted path runs straight
// into it and a greedy \S+ swallows the separator, yielding `E:\PA;`.
// Caught by this test, not by reading the regex.
test('a shell separator is not part of the path', () => {
  assert.equal(
    effectiveRepo(String.raw`Set-Location E:\PA; git add . ; git commit -m x`, 'sess'),
    String.raw`E:\PA`,
  );
  assert.equal(effectiveRepo('cd /e/space && git commit -m x', 'sess'), '/e/space');
  assert.equal(effectiveRepo('cd /e/space; git commit -m x', 'sess'), '/e/space');
});
