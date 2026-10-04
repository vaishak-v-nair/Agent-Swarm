import * as THREE from 'three';
import { ADAPTER_METADATA, getAgentEmblemSvg } from './adapters.js';

/**
 * Creates procedural glowing circular sprite texture.
 */
function createGlowSprite(colorHex = 0xffffff, innerAlpha = 1.0, outerAlpha = 0.0) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  const col = new THREE.Color(colorHex);
  const r = Math.round(col.r * 255);
  const g = Math.round(col.g * 255);
  const b = Math.round(col.b * 255);

  grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${innerAlpha})`);
  grad.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, ${innerAlpha * 0.7})`);
  grad.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, ${innerAlpha * 0.2})`);
  grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${outerAlpha})`);

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Semantic Swarm Activity Graph
 *
 * Turns the background into a living representation of agent coordination:
 * - Central Hub: Active Workspace
 * - Radial Nodes: Active agent sessions with agent-specific hues and truthful pulse states
 * - Edge Filaments: Delegation & communication lines to hub and between parallel agents
 * - Signal Pulses: Luminous packets traveling along edges on real I/O bursts
 * - Interactive HUD: Raycasted hover inspections and click-to-focus navigation
 * - Ambient Dust: Serene background starfield that settles into a quiet constellation
 */
export class BackgroundVisuals {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options; // { onSelectSession }
    this.sessions = [];
    this.panes = new Map();
    this.project = null;

    // Visual elements
    this.ambientParticles = [];
    this.agentNodes = new Map(); // sessionId -> { mesh, halo, data, angle, radius, targetPos }
    this.signalPulses = []; // Array of { start, end, progress, speed, color, mesh }
    
    // Raycasting & Interaction
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Points.threshold = 2.0;
    this.mouse = new THREE.Vector2(-999, -999);
    this.hoveredSessionId = null;
    this.clock = new THREE.Clock();

    this.init();
    this.setupHUD();
  }

  init() {
    try {
      this.scene = new THREE.Scene();

      // Camera
      this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
      this.camera.position.set(0, 0, 48);

      // Renderer
      this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      this.canvas = this.renderer.domElement;
      this.canvas.id = 'swarm-bg-canvas';
      this.canvas.style.position = 'fixed';
      this.canvas.style.top = '0';
      this.canvas.style.left = '0';
      this.canvas.style.width = '100vw';
      this.canvas.style.height = '100vh';
      this.canvas.style.zIndex = '0';
      this.canvas.style.pointerEvents = 'none'; // Window handles coordinate checks
      this.container.appendChild(this.canvas);

      this.glowTexture = createGlowSprite(0xffffff, 1.0, 0.0);

      // 1. Central Workspace Hub
      this.createCentralHub();

      // 2. Ambient Constellation Dust (for depth and quiet state)
      this.createAmbientDust();

      // 3. Dynamic Edges Geometry
      this.maxLines = 150;
      const linePositions = new Float32Array(this.maxLines * 2 * 3);
      const lineColors = new Float32Array(this.maxLines * 2 * 3);
      const linesGeo = new THREE.BufferGeometry();
      linesGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
      linesGeo.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));
      
      this.linesMaterial = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      this.linesSystem = new THREE.LineSegments(linesGeo, this.linesMaterial);
      this.scene.add(this.linesSystem);

      // Mouse Parallax & Window Listeners
      this.targetMouseX = 0;
      this.targetMouseY = 0;
      this.currentMouseX = 0;
      this.currentMouseY = 0;

      this.onMouseMove = (e) => {
        this.targetMouseX = (e.clientX / window.innerWidth) - 0.5;
        this.targetMouseY = (e.clientY / window.innerHeight) - 0.5;
        this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        this.rawMouseX = e.clientX;
        this.rawMouseY = e.clientY;
      };

      this.onClick = (e) => {
        // Only trigger session select if clicking empty workspace area or HUD
        if (e.target.closest('button, input, textarea, a, .term, .modal-backdrop, .sidebar-inner, .context-inspector-panel')) {
          return;
        }
        if (this.hoveredSessionId && this.options.onSelectSession) {
          this.options.onSelectSession(this.hoveredSessionId);
        }
      };

      window.addEventListener('mousemove', this.onMouseMove, { passive: true });
      window.addEventListener('click', this.onClick);

      this.onResize = () => {
        if (!this.renderer || !this.camera) return;
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
      };
      window.addEventListener('resize', this.onResize);

      this.isRunning = true;
      this.animate();
    } catch (err) {
      console.warn('[BackgroundVisuals] WebGL initialization skipped:', err);
    }
  }

  createCentralHub() {
    this.hubGroup = new THREE.Group();
    this.scene.add(this.hubGroup);

    // Inner Core
    const coreGeo = new THREE.SphereGeometry(1.2, 24, 24);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e, // Cyber Rose
      transparent: true,
      opacity: 0.85
    });
    this.hubCore = new THREE.Mesh(coreGeo, coreMat);
    this.hubGroup.add(this.hubCore);

    // Orbital Halo Ring
    const ringGeo = new THREE.RingGeometry(2.0, 2.3, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    this.hubRing = new THREE.Mesh(ringGeo, ringMat);
    this.hubGroup.add(this.hubRing);
  }

  createAmbientDust() {
    const count = 45;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const palette = [
      new THREE.Color(0xf43f5e),
      new THREE.Color(0x38bdf8),
      new THREE.Color(0x10b981),
      new THREE.Color(0xa855f7)
    ];

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 75;
      const y = (Math.random() - 0.5) * 45;
      const z = (Math.random() - 0.5) * 30 - 5;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const col = palette[i % palette.length];
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;

      this.ambientParticles.push({
        x, y, z,
        vx: (Math.random() - 0.5) * 0.015,
        vy: (Math.random() - 0.5) * 0.015,
        vz: (Math.random() - 0.5) * 0.01
      });
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 1.5,
      map: this.glowTexture || undefined,
      vertexColors: true,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.ambientPoints = new THREE.Points(geo, mat);
    this.scene.add(this.ambientPoints);
  }

  setupHUD() {
    let hud = document.getElementById('swarm-hover-hud');
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'swarm-hover-hud';
      hud.className = 'swarm-hover-hud';
      document.body.appendChild(hud);
    }
    this.hudEl = hud;
  }

  /**
   * Synchronize active sessions from workspace controller.
   */
  update(sessions = [], panes = new Map(), project = null) {
    this.sessions = sessions;
    this.panes = panes;
    this.project = project;

    const currentIds = new Set(sessions.map(s => s.id));

    // Remove nodes that exited
    for (const [id, node] of this.agentNodes.entries()) {
      if (!currentIds.has(id)) {
        this.scene.remove(node.group);
        node.group.traverse(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
        this.agentNodes.delete(id);
      }
    }

    // Add or update nodes
    const count = sessions.length;
    const baseRadius = count <= 2 ? 14 : count <= 4 ? 18 : 22;

    sessions.forEach((s, idx) => {
      let node = this.agentNodes.get(s.id);
      const angle = (idx / Math.max(count, 1)) * Math.PI * 2 - Math.PI / 2;
      const targetX = Math.cos(angle) * baseRadius;
      const targetY = Math.sin(angle) * (baseRadius * 0.6);
      const targetZ = Math.sin(angle * 3) * 4;

      const meta = ADAPTER_METADATA[(s.agent_type || '').toLowerCase()] || { color: '#38bdf8' };
      const nodeColor = new THREE.Color(meta.color);

      if (!node) {
        // Create new node group
        const group = new THREE.Group();
        group.position.set(targetX * 0.1, targetY * 0.1, targetZ); // Emerge from center

        // Core Sphere
        const sphereGeo = new THREE.SphereGeometry(1.4, 20, 20);
        const sphereMat = new THREE.MeshBasicMaterial({
          color: nodeColor,
          transparent: true,
          opacity: 0.95
        });
        const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
        sphereMesh.userData = { sessionId: s.id };
        group.add(sphereMesh);

        // Glowing Halo Sprite
        const haloMat = new THREE.SpriteMaterial({
          map: createGlowSprite(nodeColor.getHex(), 0.9, 0.0),
          color: nodeColor,
          transparent: true,
          opacity: 0.7,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        const haloSprite = new THREE.Sprite(haloMat);
        haloSprite.scale.set(7.5, 7.5, 1);
        group.add(haloSprite);

        this.scene.add(group);

        node = {
          id: s.id,
          group,
          sphereMesh,
          haloSprite,
          color: nodeColor,
          currentX: targetX * 0.1,
          currentY: targetY * 0.1,
          currentZ: targetZ,
          targetX,
          targetY,
          targetZ,
          session: s
        };
        this.agentNodes.set(s.id, node);
      } else {
        // Update positions & session data
        node.targetX = targetX;
        node.targetY = targetY;
        node.targetZ = targetZ;
        node.session = s;
      }
    });
  }

  /**
   * Emit a luminous signal packet along an edge when an agent performs a tool burst.
   */
  emitActivity(paneId) {
    const session = this.sessions.find(s => s.pane_id === paneId);
    if (!session) return;
    const node = this.agentNodes.get(session.id);
    if (!node) return;

    // Create signal packet traveling from node to hub
    const pulseMat = new THREE.SpriteMaterial({
      map: this.glowTexture,
      color: node.color,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const pulseSprite = new THREE.Sprite(pulseMat);
    pulseSprite.scale.set(2.2, 2.2, 1);
    pulseSprite.position.copy(node.group.position);
    this.scene.add(pulseSprite);

    this.signalPulses.push({
      mesh: pulseSprite,
      start: node.group.position.clone(),
      end: new THREE.Vector3(0, 0, 0),
      progress: 0,
      speed: 0.035 + Math.random() * 0.02
    });
  }

  animate() {
    if (!this.isRunning) return;
    requestAnimationFrame(() => this.animate());

    const time = this.clock.getElapsedTime();

    // 1. Central Hub Dynamics
    const activeCount = this.sessions.filter(s => s.status === 'working' || s.status === 'needs_attention').length;
    const hubBaseScale = activeCount > 0 ? 1.0 + Math.sin(time * 2.5) * 0.15 : 0.85 + Math.sin(time * 0.8) * 0.05;
    this.hubCore.scale.set(hubBaseScale, hubBaseScale, hubBaseScale);
    this.hubRing.rotation.z += 0.008;
    this.hubRing.rotation.x = Math.sin(time * 0.5) * 0.25;

    // 2. Ambient Constellation Drift
    if (this.ambientPoints) {
      const posAttr = this.ambientPoints.geometry.attributes.position;
      const count = this.ambientParticles.length;
      for (let i = 0; i < count; i++) {
        const p = this.ambientParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;

        if (p.x < -38 || p.x > 38) p.vx *= -1;
        if (p.y < -22 || p.y > 22) p.vy *= -1;
        if (p.z < -20 || p.z > 10) p.vz *= -1;

        posAttr.array[i * 3] = p.x;
        posAttr.array[i * 3 + 1] = p.y;
        posAttr.array[i * 3 + 2] = p.z;
      }
      posAttr.needsUpdate = true;
    }

    // 3. Agent Nodes Animation & Positioning
    const interactiveMeshes = [];
    for (const node of this.agentNodes.values()) {
      // Smooth spring to target orbital location
      node.currentX += (node.targetX - node.currentX) * 0.06;
      node.currentY += (node.targetY - node.currentY) * 0.06;
      node.currentZ += (node.targetZ - node.currentZ) * 0.06;

      const idleFloatY = Math.sin(time * 1.5 + node.targetX) * 0.6;
      node.group.position.set(node.currentX, node.currentY + idleFloatY, node.currentZ);

      // State-driven pulse scale
      const s = node.session;
      const isWorking = s.status === 'working';
      const isNeedy = s.status === 'needs_attention' || s.attention_score >= 25;

      let scale = 1.0;
      let haloAlpha = 0.5;

      if (isNeedy) {
        scale = 1.1 + Math.sin(time * 8) * 0.35; // Urgent beacon
        haloAlpha = 0.85;
      } else if (isWorking) {
        scale = 1.0 + Math.sin(time * 3.5) * 0.2; // Breathing focus
        haloAlpha = 0.7;
      } else {
        scale = 0.9 + Math.sin(time * 1.2) * 0.08; // Calm idle
        haloAlpha = 0.35;
      }

      node.sphereMesh.scale.set(scale, scale, scale);
      node.haloSprite.scale.set(scale * 7.5, scale * 7.5, 1);
      node.haloSprite.material.opacity = haloAlpha;

      interactiveMeshes.push(node.sphereMesh);
    }

    // 4. Edges / Filaments to Central Hub and Peer Nodes
    const linePosAttr = this.linesSystem.geometry.attributes.position;
    const lineColAttr = this.linesSystem.geometry.attributes.color;
    let lineIdx = 0;

    const nodesArr = [...this.agentNodes.values()];
    for (let i = 0; i < nodesArr.length; i++) {
      if (lineIdx >= this.maxLines) break;
      const na = nodesArr[i];

      // Edge from Node -> Central Hub
      const vIdx = lineIdx * 6;
      linePosAttr.array[vIdx] = na.group.position.x;
      linePosAttr.array[vIdx + 1] = na.group.position.y;
      linePosAttr.array[vIdx + 2] = na.group.position.z;

      lineColAttr.array[vIdx] = na.color.r * 0.7;
      lineColAttr.array[vIdx + 1] = na.color.g * 0.7;
      lineColAttr.array[vIdx + 2] = na.color.b * 0.7;

      linePosAttr.array[vIdx + 3] = 0;
      linePosAttr.array[vIdx + 4] = 0;
      linePosAttr.array[vIdx + 5] = 0;

      lineColAttr.array[vIdx + 3] = 0.95; // Cyber Rose blend at hub
      lineColAttr.array[vIdx + 4] = 0.25;
      lineColAttr.array[vIdx + 5] = 0.37;
      lineIdx++;

      // Inter-agent peer edges (if distance is reasonable)
      for (let j = i + 1; j < nodesArr.length; j++) {
        if (lineIdx >= this.maxLines) break;
        const nb = nodesArr[j];
        const dist = na.group.position.distanceTo(nb.group.position);
        if (dist < 35) {
          const pIdx = lineIdx * 6;
          linePosAttr.array[pIdx] = na.group.position.x;
          linePosAttr.array[pIdx + 1] = na.group.position.y;
          linePosAttr.array[pIdx + 2] = na.group.position.z;

          lineColAttr.array[pIdx] = na.color.r * 0.3;
          lineColAttr.array[pIdx + 1] = na.color.g * 0.3;
          lineColAttr.array[pIdx + 2] = na.color.b * 0.3;

          linePosAttr.array[pIdx + 3] = nb.group.position.x;
          linePosAttr.array[pIdx + 4] = nb.group.position.y;
          linePosAttr.array[pIdx + 5] = nb.group.position.z;

          lineColAttr.array[pIdx + 3] = nb.color.r * 0.3;
          lineColAttr.array[pIdx + 4] = nb.color.g * 0.3;
          lineColAttr.array[pIdx + 5] = nb.color.b * 0.3;
          lineIdx++;
        }
      }
    }

    this.linesSystem.geometry.setDrawRange(0, lineIdx * 2);
    linePosAttr.needsUpdate = true;
    lineColAttr.needsUpdate = true;

    // 5. Signal Pulses Animation
    for (let i = this.signalPulses.length - 1; i >= 0; i--) {
      const p = this.signalPulses[i];
      p.progress += p.speed;
      if (p.progress >= 1.0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry?.dispose();
        p.mesh.material?.dispose();
        this.signalPulses.splice(i, 1);
      } else {
        p.mesh.position.lerpVectors(p.start, p.end, p.progress);
        const pScale = 2.2 * Math.sin(p.progress * Math.PI);
        p.mesh.scale.set(pScale, pScale, 1);
      }
    }

    // 6. Raycast Hover Inspection
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(interactiveMeshes);

    if (intersects.length > 0) {
      const hitMesh = intersects[0].object;
      const hitSessionId = hitMesh.userData.sessionId;
      if (hitSessionId !== this.hoveredSessionId) {
        this.hoveredSessionId = hitSessionId;
        this.renderHUD(hitSessionId);
      }
      this.updateHUDPosition();
      document.body.style.cursor = 'pointer';
    } else {
      if (this.hoveredSessionId) {
        this.hoveredSessionId = null;
        this.hideHUD();
        document.body.style.cursor = 'default';
      }
    }

    // 7. Smooth Parallax & Subtle Orbit
    this.currentMouseX += (this.targetMouseX - this.currentMouseX) * 0.04;
    this.currentMouseY += (this.targetMouseY - this.currentMouseY) * 0.04;

    this.camera.position.x += (this.currentMouseX * 10 - this.camera.position.x) * 0.03;
    this.camera.position.y += (-this.currentMouseY * 6 - this.camera.position.y) * 0.03;
    this.camera.lookAt(0, 0, 0);

    this.scene.rotation.y += 0.0004;

    this.renderer.render(this.scene, this.camera);
  }

  renderHUD(sessionId) {
    if (!this.hudEl) return;
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) {
      this.hideHUD();
      return;
    }

    const meta = ADAPTER_METADATA[(session.agent_type || '').toLowerCase()] || { name: 'Agent', color: '#38bdf8' };
    const emblem = getAgentEmblemSvg(session.agent_type, session.status, 20);

    this.hudEl.innerHTML = `
      <div class="hud-inner">
        <div class="hud-top">
          <span class="hud-emblem">${emblem}</span>
          <span class="hud-name" style="color: ${meta.color}">${meta.name}</span>
          <span class="hud-status ${session.status}">${session.status}</span>
        </div>
        <div class="hud-task">${session.task_title || 'Autonomous task'}</div>
        <div class="hud-foot">
          <span class="hud-pane">Pane #${session.pane_id}</span>
          <span class="hud-action">Click to focus →</span>
        </div>
      </div>
    `;
    this.hudEl.style.display = 'block';
  }

  updateHUDPosition() {
    if (!this.hudEl || !this.rawMouseX) return;
    const offset = 18;
    let x = this.rawMouseX + offset;
    let y = this.rawMouseY + offset;

    // Boundary containment
    if (x + 240 > window.innerWidth) x = this.rawMouseX - 250;
    if (y + 110 > window.innerHeight) y = this.rawMouseY - 120;

    this.hudEl.style.left = `${x}px`;
    this.hudEl.style.top = `${y}px`;
  }

  hideHUD() {
    if (this.hudEl) this.hudEl.style.display = 'none';
  }

  destroy() {
    this.isRunning = false;
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('click', this.onClick);
    window.removeEventListener('resize', this.onResize);
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    if (this.hudEl && this.hudEl.parentNode) {
      this.hudEl.parentNode.removeChild(this.hudEl);
    }
  }
}

