import { SPRINT_MAX } from "../utils/Constants";

export class HUD {
  private root: HTMLElement;
  private heldItem: HTMLElement;
  private sprintBar: HTMLElement;
  private debugEl: HTMLElement;
  private crosshair: HTMLElement;
  private healthBar: HTMLElement;
  private healthText: HTMLElement;
  private deathOverlay: HTMLElement;
  private respawnText: HTMLElement;

  constructor() {
    this.root = document.getElementById("hud")!;
    this.heldItem = document.getElementById("held-item")!;
    this.sprintBar = document.getElementById("sprint-bar")!;
    this.debugEl = document.getElementById("debug")!;
    this.crosshair = document.getElementById("crosshair")!;
    this.healthBar = document.getElementById("health-bar")!;
    this.healthText = document.getElementById("health-text")!;
    this.deathOverlay = document.getElementById("death-overlay")!;
    this.respawnText = document.getElementById("respawn-countdown")!;
  }

  setThrowReady(ready: boolean): void {
    this.crosshair.classList.toggle("throw-ready", ready);
  }

  show(): void {
    this.root.style.display = "block";
  }
  hide(): void {
    this.root.style.display = "none";
  }

  showDeath(seconds: number): void {
    this.deathOverlay.style.display = "flex";
    this.respawnText.textContent = `Respawning in ${seconds}...`;
  }

  hideDeath(): void {
    this.deathOverlay.style.display = "none";
  }

  setHeldItem(label: string | null): void {
    this.heldItem.textContent = label ? `[ ${label} ]` : "";
  }

  setHealth(hp: number): void {
    const pct = Math.max(0, Math.min(100, hp));
    this.healthBar.style.width = `${pct}%`;
    this.healthBar.style.background =
      pct > 50 ? "#44ee66" : pct > 25 ? "#ffcc00" : "#ff4444";
    this.healthText.textContent = String(Math.ceil(pct));
  }

  setStamina(value: number): void {
    const pct = (value / SPRINT_MAX) * 100;
    this.sprintBar.style.width = `${pct}%`;
    this.sprintBar.style.background = pct < 20 ? "#ff4444" : "#fff";
  }

  setDebug(lines: Record<string, string | number>): void {
    this.debugEl.innerHTML = Object.entries(lines)
      .map(([k, v]) => `${k}: <b>${v}</b>`)
      .join("<br>");
  }
}
