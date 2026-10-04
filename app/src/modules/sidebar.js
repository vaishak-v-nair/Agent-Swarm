/**
 * Sidebar Component — Left navigation bar managing projects, nav sections, and active agent sessions.
 */

import { workspace } from './workspace.js';
import { adapterMgr, getAgentEmblemSvg } from './adapters.js';

export function renderSidebar(container, options = {}) {
  const { onNewTask, onNewShell, onSelectSession, onSelectNav, onSelectProject } = options;
  const p = workspace.activeProject;
  const sessions = workspace.sessions;
  const activeNav = workspace.activeNav;
  const activeSessionId = workspace.activeSessionId;

  container.innerHTML = `
    <div class="sidebar-inner">
      <!-- Project Switcher Box -->
      <div class="sidebar-header">
        <div class="sidebar-project-box" id="sidebar-proj-btn" title="${p ? p.path : 'Click to select project'}">
          <div class="sidebar-project-top">
            <span class="proj-badge">WORKSPACE</span>
            ${p?.current_branch ? `<span class="proj-branch-tag">⌥ ${p.current_branch}</span>` : ''}
          </div>
          <div class="sidebar-project-current">
            <span class="proj-icon">📁</span>
            <span class="proj-name">${p ? p.name : 'Select Project...'}</span>
            <span class="proj-arrow">▾</span>
          </div>
        </div>
      </div>

      <!-- Quick Action: New Agent Task -->
      <div class="sidebar-actions">
        <button class="btn btn-primary btn-block sidebar-task-btn" id="sidebar-new-task-btn">
          <span class="btn-icon">+</span> New Agent Task
        </button>
      </div>

      <!-- Navigation Links -->
      <nav class="sidebar-nav">
        <div class="nav-item ${activeNav === 'home' ? 'active' : ''}" data-nav="home">
          <span class="nav-glyph">⌂</span>
          <span class="nav-label">Workspace</span>
          <span class="nav-sub-count">${sessions.length > 0 ? sessions.length : ''}</span>
        </div>
        <div class="nav-item ${activeNav === 'changes' ? 'active' : ''}" data-nav="changes">
          <span class="nav-glyph">🔀</span>
          <span class="nav-label">Working Changes</span>
        </div>
        <div class="nav-item ${activeNav === 'timeline' ? 'active' : ''}" data-nav="timeline">
          <span class="nav-glyph">⏱</span>
          <span class="nav-label">Unified Timeline</span>
        </div>
      </nav>

      <!-- Active Sessions Section -->
      <div class="sidebar-sessions-section">
        <div class="sessions-section-head">
          <span class="sessions-head-label">AGENT SWARM (${sessions.length})</span>
          <button class="sessions-add-shell-btn" id="sidebar-add-shell-btn" title="Open Human Terminal">›_</button>
        </div>
        <div class="sidebar-sessions-list">
          ${sessions.length === 0 ? `
            <div class="sidebar-empty-sessions">
              <span class="empty-spark">✦</span>
              <span>No running agents</span>
            </div>
          ` : sessions.map(s => {
            const meta = adapterMgr.getMeta(s.agent_type);
            const emblem = getAgentEmblemSvg(s.agent_type, s.status, 16);
            const isSelected = activeNav === 'session' && s.id === activeSessionId;
            const isNeedy = s.attention_score >= 25 || s.status === 'needs_attention';
            return `
              <div class="sidebar-session-item ${isSelected ? 'selected' : ''} ${isNeedy ? 'attention' : ''} ${s.status}" data-session-id="${s.id}">
                <div class="session-item-top">
                  <span class="session-emblem-wrap">${emblem}</span>
                  <span class="session-item-agent" style="color: ${meta.color}">${meta.shortName || meta.name}</span>
                  <span class="session-item-pane">#${s.pane_id}</span>
                  <span class="session-item-dot ${s.status}"></span>
                </div>
                <div class="session-item-title" title="${s.task_title}">${s.task_title}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Sidebar Footer -->
      <div class="sidebar-footer">
        <div class="sidebar-footer-text">
          <span class="footer-dot-green"></span>
          <span>AgentSwarm • ConPTY Truth</span>
        </div>
      </div>
    </div>
  `;

  // Attach event handlers
  container.querySelector('#sidebar-new-task-btn')?.addEventListener('click', () => {
    if (onNewTask) onNewTask();
  });

  container.querySelector('#sidebar-add-shell-btn')?.addEventListener('click', () => {
    if (onNewShell) onNewShell();
  });

  container.querySelector('#sidebar-proj-btn')?.addEventListener('click', () => {
    if (onSelectProject) onSelectProject();
  });

  container.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => {
      const nav = el.dataset.nav;
      workspace.selectNav(nav);
      if (onSelectNav) onSelectNav(nav);
    });
  });

  container.querySelectorAll('.sidebar-session-item').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.sessionId;
      workspace.selectSession(id);
      if (onSelectSession) onSelectSession(id);
    });
  });
}

