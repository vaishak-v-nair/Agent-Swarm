/**
 * Workspace State Coordinator — Coordinates Projects, Tasks/Sessions, Nav, and View Modes.
 */

import { invoke } from '@tauri-apps/api/core';

export class WorkspaceController {
  constructor() {
    this.projects = [];
    this.activeProject = null;
    this.sessions = [];
    this.activeSessionId = null;
    this.activeNav = 'home'; // 'home' | 'projects' | 'changes' | 'timeline' | 'doctor'
    this.activeSessionTab = 'conversation'; // 'conversation' | 'changes' | 'verification' | 'raw'
    this.drawerOpen = false;
    this.activeDrawerPane = null;
    this.drawerManuallyToggled = false;
    this.listeners = new Set();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    for (const fn of this.listeners) {
      try { fn(this); } catch (e) { console.error('Workspace notification error:', e); }
    }
  }

  async init(cwd = null) {
    try {
      this.projects = await invoke('list_projects', { cwd });
      if (this.projects.length > 0) {
        this.activeProject = this.projects[0];
      }
      this.sessions = await invoke('list_sessions');
    } catch (e) {
      console.error('Failed to init workspace:', e);
    }
    this.notify();
  }

  selectNav(nav) {
    this.activeNav = nav;
    if (nav === 'home') {
      this.activeSessionId = null;
    }
    this.notify();
  }

  selectProject(projectId) {
    const p = this.projects.find(x => x.id === projectId);
    if (p) {
      this.activeProject = p;
      this.notify();
    }
  }

  selectSession(sessionId) {
    this.activeSessionId = sessionId;
    if (sessionId) {
      this.activeNav = 'session';
    }
    this.notify();
  }

  selectSessionTab(tab) {
    this.activeSessionTab = tab;
    this.notify();
  }

  toggleDrawer(force = null) {
    this.drawerOpen = force !== null ? force : !this.drawerOpen;
    if (force === null) this.drawerManuallyToggled = true;
    this.notify();
  }

  setDrawerPane(paneId) {
    this.activeDrawerPane = paneId;
    this.drawerOpen = true;
    this.notify();
  }

  getActiveSession() {
    return this.sessions.find(s => s.id === this.activeSessionId) || null;
  }

  addSession(session) {
    this.sessions.unshift(session);
    this.activeSessionId = session.id;
    this.activeNav = 'session';
    this.notify();
  }

  updateSession(paneId, updates) {
    const s = this.sessions.find(x => x.pane_id === paneId);
    if (s) {
      Object.assign(s, updates);
      this.notify();
    }
  }
}

export const workspace = new WorkspaceController();
