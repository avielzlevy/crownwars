import { SPRINT_MAX } from '../utils/Constants';

export class HUD {
  private root:       HTMLElement;
  private heldItem:   HTMLElement;
  private sprintBar:  HTMLElement;
  private debugEl:    HTMLElement;
  private crosshair:  HTMLElement;

  constructor() {
    this.root      = document.getElementById('hud')!;
    this.heldItem  = document.getElementById('held-item')!;
    this.sprintBar = document.getElementById('sprint-bar')!;
    this.debugEl   = document.getElementById('debug')!;
    this.crosshair = document.getElementById('crosshair')!;
  }

  setThrowReady(ready: boolean): void {
    this.crosshair.classList.toggle('throw-ready', ready);
  }

  show(): void { this.root.style.display = 'block'; }
  hide(): void { this.root.style.display = 'none';  }

  setHeldItem(label: string | null): void {
    this.heldItem.textContent = label ? `[ ${label} ]` : '';
  }

  setStamina(value: number): void {
    const pct = (value / SPRINT_MAX) * 100;
    this.sprintBar.style.width = `${pct}%`;
    this.sprintBar.style.background = pct < 20 ? '#ff4444' : '#fff';
  }

  setDebug(lines: Record<string, string | number>): void {
    this.debugEl.innerHTML = Object.entries(lines)
      .map(([k, v]) => `${k}: <b>${v}</b>`)
      .join('<br>');
  }
}
