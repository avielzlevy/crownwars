import * as THREE from 'three';

const TRACER_DURATION = 0.12; // seconds
const TRACER_WIDTH    = 0.04;

/**
 * A brief line/quad swoosh drawn from origin to impact point.
 * Fades out over TRACER_DURATION seconds.
 */
export class Tracer {
  private mesh: THREE.Mesh;
  private material: THREE.MeshBasicMaterial;
  private elapsed  = 0;
  active           = false;

  constructor(scene: THREE.Scene) {
    const geo = new THREE.PlaneGeometry(1, TRACER_WIDTH);
    this.material = new THREE.MeshBasicMaterial({
      color:       0xffffff,
      transparent: true,
      opacity:     0,
      depthWrite:  false,
      side:        THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  fire(from: THREE.Vector3, to: THREE.Vector3): void {
    const mid    = from.clone().lerp(to, 0.5);
    const length = from.distanceTo(to);
    const dir    = to.clone().sub(from).normalize();

    this.mesh.position.copy(mid);
    // Orient the plane along the from→to vector
    this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
    this.mesh.scale.set(length, 1, 1);

    this.material.opacity = 0.85;
    this.material.color.set(0xffeedd);
    this.mesh.visible = true;
    this.elapsed      = 0;
    this.active       = true;
  }

  update(delta: number): void {
    if (!this.active) return;
    this.elapsed += delta;
    const t = this.elapsed / TRACER_DURATION;

    if (t >= 1) {
      this.mesh.visible  = false;
      this.material.opacity = 0;
      this.active        = false;
      return;
    }

    // Fade out and thin down
    this.material.opacity = 0.85 * (1 - t);
    this.mesh.scale.y     = 1 - t * 0.8;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
