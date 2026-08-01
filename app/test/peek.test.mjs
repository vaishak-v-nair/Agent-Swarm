import { test } from 'node:test';
import assert from 'node:assert/strict';
import { worthShowing } from '../src/peek.js';

// A folded pane in the rail showed "8". That is worse than showing nothing:
// it looks like information and is not. These are the shapes that produced it,
// written in a file rather than through a shell, because shell-escaped
// backslashes have misreported this exact regex twice.
const B = String.fromCharCode(92);

test('fragments and prompts are not a glance at the work', () => {
  for (const junk of [
    '8', '42', '  7  ',            // bare numbers — what actually shipped
    '>', '$', '#',                 // bare prompt characters
    '---', '===', '...',           // separators
    'PS E:' + B + 'agent-swarm>',  // a PowerShell prompt
    'PS C:' + B + 'Users' + B + 'vaish>',
    'E:' + B + 'work>',            // cmd.exe
    'abc',                         // too short to mean anything
    '─'.repeat(40),            // box drawing — Claude's own TUI border
    '─── ───',
    '⠇ ', '⠋⠙',              // braille spinner frames
    '**********',
  ]) {
    assert.equal(worthShowing(junk), false, `should have been rejected: ${JSON.stringify(junk)}`);
  }
});

test('real output still gets through', () => {
  for (const real of [
    'Compiling agentswarm v0.1.0',
    'test result: ok. 35 passed; 0 failed',
    '● Reading src/main.js',
    'Do you want to make this edit to state.js?',
    'error[E0063]: missing field `profiles`',
  ]) {
    assert.equal(worthShowing(real), true, `should have been kept: ${JSON.stringify(real)}`);
  }
});
