import * as THREE from 'three';
import type { HeldItem } from '../systems/PickupSystem';

const _swingAxis = new THREE.Vector3();
const _swingQuat = new THREE.Quaternion();

/**
 * How the chair is oriented in the hand:
 * - Rotate 180° on Y so the backrest faces toward the enemy (forward).
 * - Tilt ~20° on X so the seat faces slightly upward — "held by the leg" look.
 */
const BASE_HELD_ROT = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(THREE.MathUtils.degToRad(-20), Math.PI, 0, 'YXZ'),
);

export class HeldItemView {
  private current: THREE.Object3D | null = null;
  private scene: THREE.Scene;

  // FP: slightly right, lowered, close — leg grip feel
  private readonly fpOffset = new THREE.Vector3(0.38, -0.32, -0.6);

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  get mesh(): THREE.Object3D | null { return this.current; }

  show(item: HeldItem): void {
    this.hide();
    const mesh = item.chair.mesh.clone();
    mesh.scale.multiplyScalar(0.55);
    this.current = mesh;
    this.scene.add(mesh);
  }

  hide(): void {
    if (this.current) {
      this.scene.remove(this.current);
      this.current = null;
    }
  }

  /**
   * @param swingT  0→1→0 over the swing arc
   */
  update(
    camera: THREE.Camera,
    mode: 'first' | 'third',
    playerPos: THREE.Vector3,
    swingT = 0,
  ): void {
    if (!this.current) return;

    if (mode === 'first') {
      const offset = this.fpOffset.clone().applyQuaternion(camera.quaternion);
      this.current.position.copy(camera.position).add(offset);

      // Base orientation: camera look + held rotation (backrest faces enemy)
      this.current.quaternion.multiplyQuaternions(camera.quaternion, BASE_HELD_ROT);

      if (swingT > 0) {
        // Pull slightly back then slam forward — backrest sweeps through
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        this.current.position.addScaledVector(fwd, swingT * 0.3);
        this.current.position.y += swingT * 0.08; // slight upward loft

        // Arc: rotate around camera right axis in the OPPOSITE direction
        // (backrest swings down-forward like an overhead strike)
        _swingAxis.set(1, 0, 0).applyQuaternion(camera.quaternion);
        _swingQuat.setFromAxisAngle(_swingAxis, swingT * -Math.PI * 0.6);
        this.current.quaternion.premultiply(_swingQuat);

        // Side sweep: slight Z tilt in opposite direction
        _swingAxis.set(0, 0, 1).applyQuaternion(camera.quaternion);
        _swingQuat.setFromAxisAngle(_swingAxis, swingT * 0.35);
        this.current.quaternion.premultiply(_swingQuat);
      }
    } else {
      // TP: right-hand offset
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      right.y = 0;
      right.normalize();
      this.current.position
        .copy(playerPos)
        .addScaledVector(right, 0.55)
        .setY(playerPos.y + 0.8);

      this.current.quaternion.multiplyQuaternions(camera.quaternion, BASE_HELD_ROT);

      if (swingT > 0) {
        // TP swing: backrest sweeps forward-right
        this.current.position.addScaledVector(right, swingT * 0.35);
        _swingAxis.set(0, 1, 0);
        _swingQuat.setFromAxisAngle(_swingAxis, swingT * Math.PI * 0.5);
        this.current.quaternion.premultiply(_swingQuat);
      }
    }
  }
}
