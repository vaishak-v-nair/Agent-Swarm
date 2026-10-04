/**
 * Session View — Task-Centric Workspace View.
 *
 * Renders the active task, structured conversation cards, git changes, verification,
 * and the task-centric Session Inception state (no empty black rectangles).
 */

import { workspace } from './workspace.js';
import { adapterMgr, getAgentEmblemSvg } from './adapters.js';

export function renderSessionView(container, session, options = {}) {
  if (!session) {
    container.innerHTML = `
      <div class="session-not-found">
        <div class="empty-title">Session Not Found</div>
        <button class="btn btn-secondary" id="return-home-btn">Return to Home</button>
      </div>
    `;
    container.querySelector('#return-home-btn')?.addEventListener('click', () => workspace.selectNav('home'));
    return;
  }

  const meta = adapterMgr.getMeta(session.agent_type);
  const emblem = getAgentEmblemSvg(session.agent_type, session.status, 20);
  const activeTab = workspace.activeSessionTab || 'conversation';
  const hasEvents = options.cards && options.cards.length > 0;

  container.innerHTML = `
    <div class="session-view">
      <!-- Session Header -->
      <div class="session-head">
        <div class="session-head-main">
          <div class="session-head-top">
            <span class="session-agent-badge ${meta.badgeClass}">
              <span class="badge-emblem">${emblem}</span>
              <span class="badge-name">${meta.name}</span>
            </span>
            <span class="session-status-pill ${session.status}">
              ${session.status.replace('_', ' ')}
            </span>
            ${session.attention_score >= 25 ? `
              <span class="session-attn-badge">Attention Score: ${session.attention_score}</span>
            ` : ''}
            <span class="session-branch-pill">⌥ ${session.branch || 'main'}</span>
          </div>
          <h2 class="session-task-title">${session.task_title}</h2>
          <div class="session-cwd-sub">${session.cwd}</div>
        </div>

        <div class="session-nav-tabs">
          <button class="session-tab-btn ${activeTab === 'conversation' ? 'active' : ''}" data-tab="conversation">
            💬 Conversation
          </button>
          <button class="session-tab-btn ${activeTab === 'changes' ? 'active' : ''}" data-tab="changes">
            🔀 Changes
          </button>
          <button class="session-tab-btn ${activeTab === 'verification' ? 'active' : ''}" data-tab="verification">
            ✓ Verification
          </button>
        </div>
      </div>

      <!-- Attention Action Banner (if active) -->
      ${session.status === 'needs_attention' || session.attention_score >= 25 ? `
        <div class="session-action-bar">
          <span class="action-bar-icon">⚡</span>
          <span class="action-bar-text">${session.status_reason || 'Agent is waiting on human input or tool permission.'}</span>
          <div class="action-bar-buttons" id="session-action-buttons"></div>
        </div>
      ` : ''}

      <!-- Main Body Area -->
      <div class="session-body-area">
        ${activeTab === 'conversation' ? `
          <div class="session-tab-panel conversation-panel" id="session-cards-container">
            ${!hasEvents ? `
              <div class="session-inception-card honest-state">
                <div class="empty-title">watching for a session…</div>
              </div>
            ` : ''}
          </div>
        ` : activeTab === 'changes' ? `
          <div class="session-tab-panel changes-panel" id="session-changes-container">
            <div class="panel-loading">Inspecting working tree changes...</div>
          </div>
        ` : activeTab === 'verification' ? `
          <div class="session-tab-panel verification-panel" id="session-verification-container">
            <div class="verif-head">
              <div class="verif-title">Verification Suite</div>
              <button class="btn btn-sm btn-primary" id="session-run-tests-btn">Run Suite Now</button>
            </div>
            <div class="verif-body" id="verif-output-box">
              <div class="verif-empty">Click "Run Suite Now" to verify code changes against test suites.</div>
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;

  // Attach tab events
  container.querySelectorAll('.session-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      workspace.selectSessionTab(tab);
      if (options.onTabChange) options.onTabChange(tab);
    });
  });

  container.querySelector('#inception-open-term-btn')?.addEventListener('click', () => {
    workspace.setDrawerPane(session.pane_id);
  });

  container.querySelector('#session-run-tests-btn')?.addEventListener('click', () => {
    if (options.onRunVerification) options.onRunVerification(session);
  });
}
