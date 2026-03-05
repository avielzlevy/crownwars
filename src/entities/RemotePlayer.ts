import * as THREE from 'three';
import type { S_PlayerState } from '../net/NetworkTypes';

const LERP_SPEED  = 12;   // position/rotation smoothing
const SKIN_COLOR  = 0x4466ff; // blue — distinct from bots (green) and dummies (yellow)

export class RemotePlayer {
  readonly root     = new THREE.Group();
  readonly id:      string;
  private meshes:   THREE.Mesh[] = [];

  // Interpolation targets
  private targetPos = new THREE.Vector3();
  private targetYaw = 0;
  private legTimer  = 0;
  private isMoving  = false;

  constructor(state: S_PlayerState, scene: THREE.Scene) {
    this.id = state.id;
    this.buildVisual();
    this.applyState(state);
    scene.add(this.root);
  }

  private buildVisual(): void {
    const mat = () => new THREE.MeshLambertMaterial({ color: SKIN_COLOR });

    const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number): THREE.Mesh => {
      const m = new THREE.Mesh(geo, mat());
      m.position.set(x, y, z);
      m.castShadow = true;
      this.root.add(m);
      this.meshes.push(m);
      return m;
    };

    // Same proportions as Bot / TestDummy
    add(new THREE.BoxGeometry(0.42, 0.6, 0.28),  0, 1.0,  0); // torso
    add(new THREE.SphereGeometry(0.16, 8, 8),     0, 1.58, 0); // head
    add(new THREE.BoxGeometry(0.12, 0.5, 0.12), -0.29, 1.0, 0); // L arm
    add(new THREE.BoxGeometry(0.12, 0.5, 0.12),  0.29, 1.0, 0); // R arm
    add(new THREE.BoxGeometry(0.16, 0.55, 0.18), -0.13, 0.38, 0); // L leg
    add(new THREE.BoxGeometry(0.16, 0.55, 0.18),  0.13, 0.38, 0); // R leg
  }

  /** Called on every server gameState tick — sets the interpolation target. */
  applyState(state: S_PlayerState): void {
    const prev = this.targetPos.clone();
    this.targetPos.set(state.position.x, state.position.y, state.position.z);
    this.targetYaw = state.rotation.y;
    this.isMoving  = prev.distanceToSquared(this.targetPos) > 0.0001;
  }

  update(delta: number): void {
    // Smooth position
    this.root.position.lerp(this.targetPos, Math.min(1, LERP_SPEED * delta));

    // Smooth yaw
    const dyaw = this.targetYaw - this.root.rotation.y;
    // Wrap to [-π, π]
    const wrapped = ((dyaw + Math.PI) % (Math.PI * 2)) - Math.PI;
    this.root.rotation.y += wrapped * Math.min(1, LERP_SPEED * delta);

    // Walking animation
    if (this.isMoving) {
      this.legTimer += delta * 8;
      const swing = Math.sin(this.legTimer) * 0.35;
      if (this.meshes[4]) this.meshes[4].rotation.x =  swing;
      if (this.meshes[5]) this.meshes[5].rotation.x = -swing;
      if (this.meshes[2]) this.meshes[2].rotation.x = -swing * 0.5;
      if (this.meshes[3]) this.meshes[3].rotation.x =  swing * 0.5;
    } else {
      if (this.meshes[4]) this.meshes[4].rotation.x = 0;
      if (this.meshes[5]) this.meshes[5].rotation.x = 0;
      if (this.meshes[2]) this.meshes[2].rotation.x = 0;
      if (this.meshes[3]) this.meshes[3].rotation.x = 0;
    }
  }

  destroy(scene: THREE.Scene): void {
    scene.remove(this.root);
  }
}
