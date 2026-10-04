/**
 * Home Workspace View — "Living Agent Workshop"
 *
 * Prioritizes active work, truthful agent state, and instant answers to:
 * 1. What is currently happening?
 * 2. Which agents are working?
 * 3. What changed?
 * 4. Does anything need me?
 */

import { workspace } from './workspace.js';
import { adapterMgr, getAgentEmblemSvg } from './adapters.js';
import { fmt } from '../state.js';

export function renderHome(container, options = {}) {
  const { onNewTask, onOpenProject, onRunVerification, onLaunchShell, onFocusSession, onNewTaskWithAgent, panes, changes } = options;
  const p = workspace.activeProject;
  const sessions = workspace.sessions;
  const now = Date.now();

  const activeSessions = sessions.filter(s => s.status === 'working' || s.status === 'starting' || s.status === 'needs_attention');
  const needySession = sessions.find(s => s.status === 'needs_attention' || s.attention_score >= 25);
  const totalChangedFiles = changes?.files?.length ?? 0;

  // Build headline
  let headlineHtml = '';
  if (activeSessions.length > 0) {
    const workingCount = sessions.filter(s => s.status === 'working').length;
    const waitingCount = sessions.filter(s => s.status === 'needs_attention' || s.attention_score >= 25).length;
    headlineHtml = `
      <div class="workshop-headline active">
        <span class="pulse-beacon working"></span>
        <div class="headline-copy">
          <span class="headline-count">${activeSessions.length} agent${activeSessions.length > 1 ? 's' : ''} working</span>
          <span class="headline-proj">on ${p ? p.name : 'Workspace'}</span>
        </div>
        <div class="headline-tags">
          ${workingCount > 0 ? `<span class="tag-working">${workingCount} active</span>` : ''}
          ${waitingCount > 0 ? `<span class="tag-waiting">${waitingCount} waiting on you</span>` : ''}
          ${totalChangedFiles > 0 ? `<span class="tag-changes">${totalChangedFiles} file${totalChangedFiles > 1 ? 's' : ''} touched</span>` : ''}
        </div>
      </div>
    `;
  } else {
    headlineHtml = `
      <div class="workshop-headline quiet">
        <span class="pulse-beacon idle"></span>
        <div class="headline-copy">
          <span class="headline-count">Your swarm is quiet</span>
          <span class="headline-proj">${p ? `in ${p.name}` : ''}</span>
        </div>
        <span class="headline-sub">Ready to coordinate your next coding task</span>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="living-workshop-view">
      <!-- 1. Contextual Workshop Header -->
      <header class="workshop-header">
        <div class="workshop-header-left">
          ${headlineHtml}
          <div class="workshop-project-path" title="${p ? p.path : ''}">
            <span class="path-icon">📁</span>
            <span class="path-text">${p ? p.path : 'No active workspace selected'}</span>
            ${p?.current_branch ? `<span class="branch-tag">⌥ ${p.current_branch}</span>` : ''}
          </div>
        </div>

        <div class="workshop-header-actions">
          <button class="btn btn-primary btn-task-cta" id="home-new-task-btn" title="Create new task (⌘N)">
            <span class="btn-icon">+</span> New Agent Task
          </button>
          <button class="btn btn-secondary" id="home-open-proj-btn" title="Switch active workspace">
            Switch Project
          </button>
        </div>
      </header>

      <!-- 2. Human-In-The-Loop Attention Banner (if attention needed) -->
      ${needySession ? `
        <section class="workshop-attention-banner">
          <div class="attn-banner-pulse"></div>
          <div class="attn-banner-content">
            <div class="attn-banner-head">
              <span class="attn-emblem">${getAgentEmblemSvg(needySession.agent_type, 'needs_attention', 20)}</span>
              <span class="attn-agent-name">${adapterMgr.getMeta(needySession.agent_type).name}</span>
              <span class="attn-pill">Score: ${needySession.attention_score}</span>
              <span class="attn-label">ATTENTION REQUIRED</span>
            </div>
            <div class="attn-banner-title">${needySession.task_title}</div>
            <div class="attn-banner-reason">${needySession.status_reason || 'Agent is awaiting human input or permission to proceed.'}</div>
          </div>
          <div class="attn-banner-actions">
            <button class="btn btn-sm btn-primary" id="home-jump-needy-btn">
              Jump to Session →
            </button>
          </div>
        </section>
      ` : ''}

      <!-- 3. Active Work Stream (Prioritized) -->
      <section class="workshop-stream-section">
        <div class="stream-header">
          <div class="stream-label">
            <span class="stream-icon">⚡</span>
            <span>ACTIVE TASKS & COORDINATION</span>
            <span class="stream-count-badge">${sessions.length}</span>
          </div>
          <div class="stream-hints">Real-time execution status & progress</div>
        </div>

        ${sessions.length === 0 ? `
          <!-- Editorial Empty State -->
          <div class="workshop-empty-state">
            <div class="empty-illustration">
              <svg width="180" height="85" viewBox="0 0 180 85" fill="none" class="sleeping-swarm-svg">
                <line x1="45" y1="45" x2="90" y2="35" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" stroke-dasharray="3 3"/>
                <line x1="90" y1="35" x2="135" y2="45" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" stroke-dasharray="3 3"/>
                <!-- Left Node (Claude) -->
                <circle cx="45" cy="45" r="14" fill="#12151e" stroke="#d99f5b" stroke-width="1.5" stroke-opacity="0.6"/>
                <circle cx="45" cy="45" r="4" fill="#d99f5b" fill-opacity="0.5"/>
                <path d="M41 43 Q45 46 49 43" stroke="#d99f5b" stroke-width="1.5" stroke-linecap="round" fill="none"/>
                <!-- Center Node (Hub) -->
                <circle cx="90" cy="35" r="18" fill="#12151e" stroke="#f43f5e" stroke-width="1.8" stroke-opacity="0.7"/>
                <circle cx="90" cy="35" r="5" fill="#f43f5e" fill-opacity="0.6"/>
                <path d="M85 33 Q90 37 95 33" stroke="#f43f5e" stroke-width="1.5" stroke-linecap="round" fill="none"/>
                <!-- Right Node (Codex) -->
                <circle cx="135" cy="45" r="14" fill="#12151e" stroke="#10b981" stroke-width="1.5" stroke-opacity="0.6"/>
                <circle cx="135" cy="45" r="4" fill="#10b981" fill-opacity="0.5"/>
                <path d="M131 43 Q135 46 139 43" stroke="#10b981" stroke-width="1.5" stroke-linecap="round" fill="none"/>
                <!-- Dream particles -->
                <circle cx="108" cy="18" r="1.5" fill="#38bdf8" fill-opacity="0.7"/>
                <circle cx="116" cy="12" r="2.2" fill="#a855f7" fill-opacity="0.6"/>
              </svg>
            </div>
            <div class="empty-title">Your swarm is quiet.</div>
            <div class="empty-desc">
              Launch a coding agent to plan an implementation, refactor components, or run tests in parallel.
            </div>
            <div class="empty-actions">
              <button class="btn btn-primary" id="home-empty-new-task-btn">+ Create First Task <kbd>⌘N</kbd></button>
              <button class="btn btn-secondary" id="home-empty-quick-shell">›_ Open Terminal</button>
            </div>
          </div>
        ` : `
          <div class="workshop-task-stream">
            ${sessions.map(s => {
              const meta = adapterMgr.getMeta(s.agent_type);
              const p = panes?.get ? panes.get(s.pane_id) : null;
              const emblem = getAgentEmblemSvg(s.agent_type, s.status, 24);
              
              // Truthful duration and peek calculation
              let elapsedStr = '';
              if (p?.born) {
                elapsedStr = fmt(now - p.born);
              }
              const peekText = p?.lastCard || p?.lastLine || s.status_reason || 'Autonomous agent session';

              // Truthful state formatting
              let stateLabel = s.status;
              if (p?.state?.label) {
                stateLabel = p.state.label;
              }

              return `
                <div class="live-task-row" data-session-id="${s.id}">
                  <div class="task-row-emblem">
                    ${emblem}
                  </div>

                  <div class="task-row-body">
                    <div class="task-row-head">
                      <span class="task-agent-name" style="color: ${meta.color}">${meta.name}</span>
                      <span class="task-pane-badge">#${s.pane_id}</span>
                      <span class="live-state-pill ${s.status}">
                        <span class="dot"></span>
                        <span class="txt">${stateLabel}${elapsedStr ? ` · ${elapsedStr}` : ''}</span>
                      </span>
                      ${s.branch ? `<span class="task-branch-pill">⌥ ${s.branch}</span>` : ''}
                    </div>

                    <div class="task-row-title">${s.task_title}</div>

                    <div class="task-row-peek">
                      <span class="peek-prompt">›</span>
                      <span class="peek-code" title="${peekText}">${peekText}</span>
                    </div>

                    <div class="task-row-foot">
                      ${elapsedStr ? `<span class="foot-meta">⏱ Runtime: ${elapsedStr}</span>` : ''}
                      ${totalChangedFiles > 0 ? `<span class="foot-meta">📄 ${totalChangedFiles} file${totalChangedFiles > 1 ? 's' : ''} modified</span>` : ''}
                      <span class="foot-meta verif-${s.verification_status}">
                        ${s.verification_status === 'passed' ? '✓ Tests Passed' :
                          s.verification_status === 'failed' ? '✕ Tests Failed' :
                          '○ Untested'}
                      </span>
                    </div>
                  </div>

                  <div class="task-row-action">
                    <button class="btn btn-sm btn-ghost task-jump-btn" data-session-id="${s.id}">
                      Open Session →
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </section>

      <!-- 4. Compact Quick Launchpad Strip -->
      <section class="workshop-launchpad-strip">
        <div class="launchpad-head-label">
          <span class="label-txt">QUICK AGENT LAUNCH:</span>
        </div>
        <div class="launchpad-pills">
          ${adapterMgr.adapters.map(a => {
            const meta = adapterMgr.getMeta(a.id);
            const emblem = getAgentEmblemSvg(a.id, 'idle', 16);
            return `
              <button class="agent-pill-btn ${a.installed ? 'installed' : 'not-installed'}" data-agent-id="${a.id}" title="${a.installed ? `Launch task with ${a.name}` : `${a.name} (not detected on PATH)`}">
                <span class="pill-emblem">${emblem}</span>
                <span class="pill-name">${meta.shortName || a.name}</span>
                ${!a.installed ? `<span class="pill-off">off</span>` : ''}
              </button>
            `;
          }).join('')}
        </div>
      </section>

      <!-- 5. Verification & Shell Strip -->
      <footer class="workshop-footer-strip">
        <div class="footer-strip-left">
          <button class="strip-btn" id="home-quick-verif">
            <span class="btn-glyph">✓</span> Run Verification Suite
          </button>
          <button class="strip-btn" id="home-quick-shell">
            <span class="btn-glyph">›_</span> Open Human Terminal (<kbd>\`</kbd>)
          </button>
        </div>
        <div class="footer-strip-right">
          <span class="footer-ver-tag">AgentSwarm v0.2.0 • Living Agent Workshop</span>
        </div>
      </footer>
    </div>
  `;

  // Attach event handlers
  container.querySelector('#home-new-task-btn')?.addEventListener('click', onNewTask);
  container.querySelector('#home-empty-new-task-btn')?.addEventListener('click', onNewTask);
  container.querySelector('#home-open-proj-btn')?.addEventListener('click', onOpenProject);
  container.querySelector('#home-quick-shell')?.addEventListener('click', onLaunchShell);
  container.querySelector('#home-empty-quick-shell')?.addEventListener('click', onLaunchShell);
  container.querySelector('#home-quick-verif')?.addEventListener('click', onRunVerification);

  if (needySession) {
    container.querySelector('#home-jump-needy-btn')?.addEventListener('click', () => {
      workspace.selectSession(needySession.id);
      if (onFocusSession) onFocusSession(needySession);
    });
  }

  // Quick agent pill clicks
  container.querySelectorAll('.agent-pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const agentId = btn.dataset.agentId;
      if (onNewTaskWithAgent) {
        onNewTaskWithAgent(agentId);
      } else if (onNewTask) {
        onNewTask();
      }
    });
  });

  // Task row click
  container.querySelectorAll('.live-task-row').forEach(row => {
    row.addEventListener('click', (e) => {
      // Avoid duplicate triggers if clicking button inside
      const id = row.dataset.sessionId;
      workspace.selectSession(id);
      if (onFocusSession) {
        const s = sessions.find(x => x.id === id);
        onFocusSession(s);
      }
    });
  });
}


