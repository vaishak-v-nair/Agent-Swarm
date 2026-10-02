// events.js — Client-side Event Fabric and SQLite query bridge
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export class AgentEventFabric {
  constructor() {
    this.subscribers = new Set();
    this.sessionToken = null;
    this.init();
  }

  async init() {
    try {
      this.sessionToken = await invoke('get_session_token');
    } catch (e) {
      // Non-Tauri or test environment
    }

    try {
      await listen('agent:event', (msg) => {
        const evt = msg.payload;
        for (const cb of this.subscribers) {
          try {
            cb(evt);
          } catch (err) {
            console.error('[events] subscriber error:', err);
          }
        }
      });
    } catch (e) {
      // Test environment fallback
    }
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  async query(paneId = null, limit = 50) {
    return await invoke('event_query', { paneId, limit });
  }

  async queryErrors(limit = 50) {
    return await invoke('event_query_errors', { limit });
  }

  async emit(paneId, kind, summary, data = null, isError = false) {
    return await invoke('event_emit', {
      paneId,
      kind,
      summary,
      data,
      isError,
    });
  }

  async steer(paneId, action, payload) {
    if (!this.sessionToken) {
      this.sessionToken = await invoke('get_session_token');
    }
    return await invoke('steer_pane', {
      token: this.sessionToken,
      paneId,
      action,
      payload,
    });
  }
}

export const eventFabric = new AgentEventFabric();
