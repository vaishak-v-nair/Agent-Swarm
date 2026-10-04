/**
 * Terminal Drawer — Collapsible, resizable bottom execution drawer hosting real ConPTY terminals.
 *
 * Guarantees interaction truth: direct keystrokes and raw output flow through
 * ConPTY without intermediary buffering.
 */

import { workspace } from './workspace.js';
import { adapterMgr, getAgentEmblemSvg } from './adapters.js';

let isDragging = false;
let startY = 0;
let startHeight = 260;
let userHeight = 260;
let isMaximized = false;

export function renderTerminalDrawer(container, panes, options = {}) {
  const { onSelectPane, onNewShell, onToggleDrawer, onMaximizeChange } = options;
  const isOpen = workspace.drawerOpen;
  const activePaneId = workspace.activeDrawerPane || (panes.size > 0 ? panes.keys().next().value : null);

  container.className = `terminal-drawer ${isOpen ? 'open' : 'closed'} ${isMaximized ? 'maximized' : ''}`;
  
  if (isOpen && !isMaximized) {
    container.style.height = `${userHeight}px`;
  } else if (!isOpen) {
    container.style.height = '';
  }

  container.innerHTML = `
    <!-- Top Drag Resizer Handle -->
    <div class="drawer-resizer" id="drawer-resizer" title="Drag to resize terminal panel">
      <div class="resizer-pill"></div>
    </div>

    <div class="drawer-header">
      <div class="drawer-tabs">
        <span class="drawer-label">EXECUTION PTY</span>
        ${[...panes.values()].map(p => {
          const isAgent = p.profile === 'claude' || p.profile === 'codex' || p.profile === 'gemini' || p.profile === 'opencode' || p.profile === 'copilot';
          const meta = adapterMgr.getMeta(p.profile);
          const emblem = getAgentEmblemSvg(p.profile, p.state?.key || 'idle', 14);
          const label = isAgent ? `${meta.shortName || meta.name} #${p.id}` : `Shell #${p.id}`;
          const isSelected = p.id === activePaneId;
          const stateKey = p.state?.key || 'idle';

          return `
            <button class="drawer-tab ${isSelected ? 'active' : ''} ${stateKey}" data-pane-id="${p.id}" title="${meta.name} (Pane #${p.id})">
              <span class="tab-lamp ${stateKey}"></span>
              <span class="tab-emblem">${emblem}</span>
              <span class="tab-label">${label}</span>
            </button>
          `;
        }).join('')}
        <button class="drawer-new-tab" id="drawer-add-shell-btn" title="Open new human shell">+</button>
      </div>

      <div class="drawer-controls">
        <button class="drawer-ctrl-btn ${isMaximized ? 'active' : ''}" id="drawer-max-btn" title="${isMaximized ? 'Restore height' : 'Maximize terminal'}">
          ${isMaximized ? '⤓' : '⛶'}
        </button>
        <button class="drawer-toggle-btn" id="drawer-toggle-btn" title="Toggle drawer (\`)">
          ${isOpen ? 'Hide Terminal ⌄' : 'Show Terminal ⌃'} <kbd>\`</kbd>
        </button>
      </div>
    </div>

    <div class="drawer-body" id="drawer-term-mount" style="${isOpen ? '' : 'display: none;'}">
    </div>
  `;

  // Attach event handlers
  container.querySelectorAll('.drawer-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const paneId = Number(tab.dataset.paneId);
      workspace.setDrawerPane(paneId);
      if (onSelectPane) onSelectPane(paneId);
    });
  });

  container.querySelector('#drawer-add-shell-btn')?.addEventListener('click', () => {
    if (onNewShell) onNewShell();
  });

  container.querySelector('#drawer-max-btn')?.addEventListener('click', () => {
    isMaximized = !isMaximized;
    container.classList.toggle('maximized', isMaximized);
    if (!isMaximized && isOpen) {
      container.style.height = `${userHeight}px`;
    }
    const btn = container.querySelector('#drawer-max-btn');
    if (btn) btn.textContent = isMaximized ? '⤓' : '⛶';

    if (activePaneId) {
      const p = panes.get(activePaneId);
      setTimeout(() => p?.fit?.fit(), 40);
    }
    if (onMaximizeChange) onMaximizeChange(isMaximized);
  });

  container.querySelector('#drawer-toggle-btn')?.addEventListener('click', () => {
    workspace.toggleDrawer();
    if (onToggleDrawer) onToggleDrawer();
  });

  // Drag Resizer Listener
  const resizer = container.querySelector('#drawer-resizer');
  if (resizer) {
    resizer.addEventListener('pointerdown', (e) => {
      if (!workspace.drawerOpen || isMaximized) return;
      isDragging = true;
      startY = e.clientY;
      startHeight = container.getBoundingClientRect().height;
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';

      const onPointerMove = (moveEvt) => {
        if (!isDragging) return;
        const delta = startY - moveEvt.clientY;
        const target = Math.min(Math.max(startHeight + delta, 140), window.innerHeight * 0.78);
        userHeight = target;
        container.style.height = `${target}px`;
      };

      const onPointerUp = () => {
        isDragging = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);

        if (activePaneId) {
          const p = panes.get(activePaneId);
          p?.fit?.fit();
        }
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });
  }

  // Mount active pane terminal
  if (isOpen && activePaneId) {
    const p = panes.get(activePaneId);
    const mount = container.querySelector('#drawer-term-mount');
    if (p && mount) {
      const termBox = p.el.querySelector('.term');
      if (termBox && termBox.parentElement !== mount) {
        mount.appendChild(termBox);
        p.fit?.fit();
      }
    }
  }
}

