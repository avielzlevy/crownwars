import * as THREE from 'three';

const TRAVEL_DURATION = 0.72; // seconds from hand to impact — slow enough to track visually
const ARC_HEIGHT      = 0.12; // very slight arc, nearly flat trajectory

// Rotation speeds (rad/s) — tumbling feel
const ROLL_X = 14;
const ROLL_Z = 9;

export class ThrowProjectile {
  private mesh:    THREE.Object3D;
  private from:    THREE.Vector3;
  private to:      THREE.Vector3;
  private elapsed  = 0;
  private scene:   THREE.Scene;
  done = false;

  /** Called exactly once when the projectile reaches its target. */
  onArrive: (() => void) | null = null;

  constructor(
    scene: THREE.Scene,
    sourceMesh: THREE.Object3D,
    from: THREE.Vector3,
    to: THREE.Vector3,
  ) {
    this.scene = scene;
    this.from  = from.clone();
    this.to    = to.clone();

    // Use the full-scale chair mesh as-is
    this.mesh = sourceMesh.clone();
    this.mesh.position.copy(from);
    scene.add(this.mesh);
  }

  update(delta: number): void {
    if (this.done) return;

    this.elapsed += delta;
    const t = Math.min(this.elapsed / TRAVEL_DURATION, 1);

    // Lerp base position
    this.mesh.position.lerpVectors(this.from, this.to, t);

    // Parabolic arc: peaks at t=0.5
    this.mesh.position.y += Math.sin(t * Math.PI) * ARC_HEIGHT;

    // Continuous tumble rotation
    this.mesh.rotation.x += ROLL_X * delta;
    this.mesh.rotation.z += ROLL_Z * delta;

    if (t >= 1) {
      this.done = true;
      this.scene.remove(this.mesh);
      this.onArrive?.();
    }
  }

  destroy(): void {
    this.scene.remove(this.mesh);
    this.done = true;
  }
}
