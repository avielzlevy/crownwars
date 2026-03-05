import * as THREE from 'three';
import type { Chair } from '../entities/Chair';
import type { SpawnSystem } from './SpawnSystem';
import { classifyPiece } from '../utils/BBoxClassifier';
import { PICKUP_RADIUS } from '../utils/Constants';

export interface HeldItem {
  chair: Chair;
  size: 'large' | 'small';
  label: string;
}

export class PickupSystem {
  held: HeldItem | null = null;

  /**
   * Called when the player presses F.
   * Finds the closest intact chair in range and picks it up.
   */
  tryPickup(
    playerPos: THREE.Vector3,
    spawn: SpawnSystem,
    scene: THREE.Scene,
  ): HeldItem | null {
    const nearby = spawn.getNearbyCchairs(playerPos, PICKUP_RADIUS);
    if (nearby.length === 0) return null;

    // Closest chair
    const chair = nearby.reduce((a, b) =>
      a.mesh.position.distanceTo(playerPos) < b.mesh.position.distanceTo(playerPos) ? a : b,
    );

    chair.state = 'held';
    scene.remove(chair.mesh); // remove from world; will be shown as held item

    const size  = classifyPiece(chair.mesh);
    const label = size === 'large' ? 'Crown Chair (Large)' : 'Crown Chair (Small)';
    this.held   = { chair, size, label };
    return this.held;
  }

  drop(scene: THREE.Scene, position: THREE.Vector3): void {
    if (!this.held) return;
    this.held.chair.state = 'intact';
    this.held.chair.mesh.position.copy(position);
    scene.add(this.held.chair.mesh);
    this.held = null;
  }

  consume(): HeldItem | null {
    const item = this.held;
    this.held  = null;
    return item;
  }
}
