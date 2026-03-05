/**
 * Raw keyboard / mouse input capture.
 * Other systems read from this — no logic lives here.
 */
export class InputSystem {
  readonly keys: Record<string, boolean> = {};
  mouseDeltaX = 0;
  mouseDeltaY = 0;
  /** Accumulated since last consumeDelta() call */
  private _dx = 0;
  private _dy = 0;

  // Action flags (consumed each frame by WeaponSystem / PickupSystem)
  pickupPressed  = false;
  meleePressed   = false;
  throwPressed   = false;
  cameraToggle   = false;

  private bound = false;

  init(): void {
    if (this.bound) return;
    this.bound = true;
    window.addEventListener('keydown', this.onKey.bind(this, true));
    window.addEventListener('keyup',   this.onKey.bind(this, false));
    window.addEventListener('mousemove', this.onMouse.bind(this));
    window.addEventListener('mousedown', this.onMouseDown.bind(this));
  }

  private onKey(down: boolean, e: KeyboardEvent): void {
    // Don't capture keys when typing in a text field
    const tag = (document.activeElement as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    this.keys[e.code] = down;
    if (down) {
      if (e.code === 'KeyF') this.pickupPressed = true;
      if (e.code === 'KeyV') this.cameraToggle  = true;
    }
  }

  private onMouse(e: MouseEvent): void {
    this._dx += e.movementX;
    this._dy += e.movementY;
  }

  private onMouseDown(e: MouseEvent): void {
    if (e.button === 0) this.meleePressed = true;
    if (e.button === 2) this.throwPressed  = true;
  }

  /** Call once per frame to snapshot and clear accumulated mouse delta. */
  consumeDelta(): { dx: number; dy: number } {
    this.mouseDeltaX = this._dx;
    this.mouseDeltaY = this._dy;
    this._dx = 0;
    this._dy = 0;
    return { dx: this.mouseDeltaX, dy: this.mouseDeltaY };
  }

  /** Call after processing action flags to clear them for next frame. */
  clearActions(): void {
    this.pickupPressed = false;
    this.meleePressed  = false;
    this.throwPressed  = false;
    this.cameraToggle  = false;
  }

  isDown(code: string): boolean {
    return !!this.keys[code];
  }
}
