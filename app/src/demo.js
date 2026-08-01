/* `agentswarm --demo` — the app drives itself, from the inside.
 *
 * The first recording was a still: two panes spawned and then sat there. Calling
 * that "self-driving" was wrong. Nothing typed, nothing ran, nothing was tested,
 * and a video of an idle window proves only that a window opened.
 *
 * Driving from outside needs the window focused, and stealing focus on a machine
 * somebody is using once put a keystroke into their game. So the driving happens
 * in here instead. These are the app's own functions called on a timer — the
 * same code paths a click or a keypress would reach, minus the operating system.
 *
 * That makes this two things at once: the demo, and the only test that exercises
 * the click targets and view switches the smoke test cannot reach.
 */

const wait = ms => new Promise(r => setTimeout(r, ms));

/** One scripted beat. `does` is the app's own action; `say` narrates it. */
const beat = (at, say, does) => ({ at, say, does });

/**
 * @param api  the app's own handles — passed in rather than imported so this
 *             file cannot reach anything it was not explicitly given.
 */
export async function runDemo(api) {
  const { flash, diag, setLayout, openTimeline, closeTimeline,
          openPalette, closePalette, showChanges, closeSheet,
          setMode, panes, focus, sendTo } = api;

  const script = [
    beat(1500, 'the cockpit, with a swarm open', null),

    beat(2500, 'sending work to a pane — no keyboard involved', () => {
      // A pane that never does anything is why the first recording was a still.
      const shell = [...panes.values()].find(p => p.profile !== 'claude' && p.alive);
      if (shell) sendTo(shell.id, 'git log --oneline -12');
    }),

    beat(4000, 'and another', () => {
      const shell = [...panes.values()].find(p => p.profile !== 'claude' && p.alive);
      if (shell) sendTo(shell.id, 'npm test --prefix app 2>&1 | Select-Object -Last 20');
    }),

    beat(5000, 'switching panes — the rail folds what you are not reading', () => {
      const ids = [...panes.keys()];
      if (ids.length > 1) focus(ids[ids.length - 1]);
    }),

    beat(3000, 'plain english: the same session, read instead of watched', () => {
      const p = panes.get([...panes.keys()][0]);
      if (p) { focus(p.id); setMode(p, true); }
    }),

    beat(3500, 'back to raw', () => {
      const p = panes.get([...panes.keys()][0]);
      if (p) setMode(p, false);
    }),

    beat(2500, 'every pane tiled', () => setLayout('grid')),
    beat(3000, 'and back to stage', () => setLayout('stage')),

    beat(2000, 'ctrl+shift+P — everything', () => openPalette()),
    beat(3000, null, () => closePalette()),

    beat(2000, 'ctrl+shift+M — every session, in the order it happened', () => openTimeline()),
    beat(3500, null, () => closeTimeline()),

    beat(2000, 'ctrl+shift+D — what changed on disk, and why', () => showChanges()),
    beat(4000, null, () => closeSheet()),

    beat(2000, 'that is the tour', null),
  ];

  diag('demo: driving the UI from inside — no OS input is sent');
  for (const b of script) {
    if (b.say) flash(b.say);
    if (b.does) {
      // A broken beat must not take the rest of the demo down with it.
      try { b.does(); } catch (e) { diag(`demo beat failed: ${e}`); }
    }
    await wait(b.at);
  }
  flash('');
  diag('demo: finished');
}

/** Total run time, so a recorder knows how long to capture. */
export const DEMO_SECONDS = 48;
