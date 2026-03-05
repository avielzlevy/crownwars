import * as THREE from 'three';
import type { ArenaScene } from '../scenes/ArenaScene';

export interface HitResult {
  hit:    true;
  point:  THREE.Vector3;
  normal: THREE.Vector3;
  object: THREE.Object3D;
  distance: number;
}

export interface MissResult { hit: false }

export type CastResult = HitResult | MissResult;

const _raycaster = new THREE.Raycaster();
_raycaster.far = 50;

/**
 * All hitscan logic lives here.
 * Accepts extra targets (chairs, bots) alongside arena colliders.
 */
export class HitscanSystem {
  cast(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    arena: ArenaScene,
    extraTargets: THREE.Object3D[] = [],
  ): CastResult {
    _raycaster.set(origin, direction.clone().normalize());

    const targets = [...arena.colliders, ...extraTargets];
    const hits    = _raycaster.intersectObjects(targets, true);

    if (hits.length === 0) return { hit: false };

    const h = hits[0];
    return {
      hit:      true,
      point:    h.point.clone(),
      normal:   (h.face?.normal ?? new THREE.Vector3(0, 1, 0)).clone(),
      object:   h.object,
      distance: h.distance,
    };
  }

  /** Convenience: cast from camera origin along camera forward. */
  castFromCamera(
    camera: THREE.Camera,
    arena: ArenaScene,
    extraTargets: THREE.Object3D[] = [],
  ): CastResult {
    const origin = new THREE.Vector3();
    const dir    = new THREE.Vector3();
    camera.getWorldPosition(origin);
    camera.getWorldDirection(dir);
    return this.cast(origin, dir, arena, extraTargets);
  }
}
