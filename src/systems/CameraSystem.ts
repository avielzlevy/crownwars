import * as THREE from 'three';
import type { MovementState } from './MovementSystem';

export type CameraMode = 'first' | 'third';

const _offset3P = new THREE.Vector3(0, 1.5, 4);

export class CameraSystem {
  readonly camera: THREE.PerspectiveCamera;
  mode: CameraMode = 'first';

  // Head bob state
  private bobT  = 0;
  private bobAmp = 0.04;

  constructor(fov = 80, near = 0.05, far = 500) {
    this.camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, near, far);
  }

  update(state: MovementState, quaternion: THREE.Quaternion, delta: number): void {
    const isMoving = state.velocity.lengthSq() > 0.1 && state.onGround;

    // Head bob (first-person only)
    if (this.mode === 'first' && isMoving) {
      this.bobT += delta * (state.isSprinting ? 14 : 8);
    } else {
      this.bobT = THREE.MathUtils.lerp(this.bobT, Math.round(this.bobT / Math.PI) * Math.PI, delta * 10);
    }

    const bobY = this.mode === 'first' ? Math.sin(this.bobT) * this.bobAmp : 0;

    const eyeHeight = state.currentHeight;

    if (this.mode === 'first') {
      this.camera.position.set(
        state.position.x,
        state.position.y + (eyeHeight * 0.5 - 0.1) + bobY,
        state.position.z,
      );
      this.camera.quaternion.copy(quaternion);
    } else {
      // Third-person: orbit behind player
      const back = _offset3P.clone().applyQuaternion(quaternion);
      this.camera.position.copy(state.position).add(back);
      this.camera.position.y += eyeHeight * 0.5;
      this.camera.lookAt(
        state.position.x,
        state.position.y + eyeHeight * 0.4,
        state.position.z,
      );
    }
  }

  onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
