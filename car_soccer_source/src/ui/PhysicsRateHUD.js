/**
 * PhysicsRateHUD.js
 * Visual indicator badge for client physics rate in the top-left HUD.
 * Renders current physics pacing rate (e.g. Phy:120.0).
 */

export class PhysicsRateHUD {
  /**
   * @param {HTMLElement} [container=document.body]
   * @param {number} [initialRate=120]
   */
  constructor(container = (typeof document !== 'undefined' ? document.body : null), initialRate = 120) {
    this.container = container;
    this.rate = initialRate;
    this.root = null;

    if (typeof document !== 'undefined') {
      this.initDOM();
    }
  }

  initDOM() {
    this.root = document.createElement('div');
    this.root.id = 'hud-physics-rate';
    this.root.className = 'hud-physics-rate';
    this.root.style.cssText = `
      position: fixed;
      top: 16px;
      left: 16px;
      background: rgba(13, 17, 23, 0.85);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      padding: 3px 8px;
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
      font-size: 11px;
      font-weight: 700;
      color: #58a6ff;
      letter-spacing: 0.5px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      z-index: 10000;
      pointer-events: none;
      user-select: none;
    `;
    this.update(this.rate);
    if (this.container) {
      this.container.appendChild(this.root);
    }
  }

  /**
   * Updates the displayed physics rate.
   * @param {number} rate
   */
  update(rate) {
    this.rate = rate;
    if (this.root) {
      this.root.textContent = `Phy:${Number(rate).toFixed(1)}`;
    }
  }

  setVisible(visible) {
    if (this.root) {
      this.root.style.display = visible ? 'block' : 'none';
    }
  }

  destroy() {
    if (this.root && this.root.parentElement) {
      this.root.parentElement.removeChild(this.root);
      this.root = null;
    }
  }
}

export default PhysicsRateHUD;
