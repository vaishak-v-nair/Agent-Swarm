/**
 * AttentionController — Multi-Modal attention cue and pane priority manager.
 *
 * Synthesizes subtle desktop audio chimes via Web Audio API without relying on external
 * audio files, updates tab badges, and maintains the ranked Attention Queue.
 */

import { invoke } from '@tauri-apps/api/core';

export class AttentionController {
  constructor(options = {}) {
    this.audioContext = null;
    this.soundEnabled = options.soundEnabled ?? true;
    this.lastLevels = new Map(); // pane_id -> level
    this.onQueueUpdated = options.onQueueUpdated || null;
  }

  /**
   * Lazy-initialize AudioContext on user interaction or first cue.
   */
  getAudioContext() {
    if (!this.audioContext && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
      }
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    return this.audioContext;
  }

  /**
   * Synthesize a gentle two-tone notification chime (D5 -> A5)
   * Non-jarring, sub-second duration, decays smoothly to silence.
   */
  playChime(level = 'action_needed') {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const baseFreq = level === 'urgent' ? 659.25 : 587.33; // E5 for urgent, D5 for action
      const highFreq = level === 'urgent' ? 987.77 : 880.00; // B5 for urgent, A5 for action

      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(highFreq, now + 0.12);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.4);
    } catch {
      // Audio playback fails silently in non-interactive / headless environments
    }
  }

  /**
   * Query ranked attention queue from Tauri backend.
   */
  async updateQueue(paneIds = []) {
    if (!paneIds || paneIds.length === 0) return [];
    try {
      const items = await invoke('get_attention_queue', { paneIds });
      this.processQueue(items);
      return items;
    } catch (e) {
      return [];
    }
  }

  /**
   * Check for state transitions and trigger multi-modal cues.
   */
  processQueue(items = []) {
    let urgentCount = 0;

    for (const item of items) {
      const prevLevel = this.lastLevels.get(item.pane_id);
      const isEscalation = (item.level === 'urgent' || item.level === 'action_needed') &&
                           (prevLevel !== item.level);

      if (isEscalation) {
        this.playChime(item.level);
      }

      if (item.level === 'urgent' || item.level === 'action_needed') {
        urgentCount++;
      }

      this.lastLevels.set(item.pane_id, item.level);
    }

    this.updateTitleBadge(urgentCount);

    if (this.onQueueUpdated) {
      this.onQueueUpdated(items);
    }
  }

  /**
   * Update browser / desktop document title with attention badge.
   */
  updateTitleBadge(count) {
    if (typeof document === 'undefined') return;
    const baseTitle = 'AgentSwarm';
    if (count > 0) {
      document.title = `(${count}) ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
  }
}
