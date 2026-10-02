// steer.js — Inter-Agent Steering UI and Palette integration
import { eventFabric } from './events.js';

export class SteerController {
  constructor() {
    this.modalEl = null;
  }

  async steerPane(paneId, message) {
    if (!paneId || !message) {
      return { success: false, message: 'missing pane or message' };
    }
    const payload = message.endsWith('\n') ? message : message + '\n';
    return await eventFabric.steer(paneId, 'steer', payload);
  }

  async pausePane(paneId) {
    if (!paneId) {
      return { success: false, message: 'missing pane' };
    }
    return await eventFabric.steer(paneId, 'pause', '');
  }
}

export const steerController = new SteerController();
