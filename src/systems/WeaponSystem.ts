import * as THREE from "three";
import type { HitscanSystem, HitResult } from "./HitscanSystem";
import type { PickupSystem } from "./PickupSystem";
import type { ArenaScene } from "../scenes/ArenaScene";
import type { HeldItemView } from "../entities/HeldItemView";

export type WeaponState = "idle" | "swinging" | "cooldown";

const MELEE_RANGE = 3.5;
const MELEE_SWING_T = 0.22;
const MELEE_COOLDOWN = 0.45;
const THROW_COOLDOWN = 0.6;

export interface ThrowLaunch {
  from: THREE.Vector3;
  to: THREE.Vector3;
  meshClone: THREE.Object3D;
  hit: boolean;
  result?: HitResult;
}

export interface WeaponEvents {
  onMeleeHit?: (result: HitResult) => void;
  onMeleeMiss?: () => void;
  onThrowLaunch?: (launch: ThrowLaunch) => void;
  /** Fired when a melee hit or throw arrival should fracture the chair. */
  onFracture?: (point: THREE.Vector3, normal: THREE.Vector3) => void;
}

export class WeaponSystem {
  state: WeaponState = "idle";
  swingT = 0; // 0→1→0 — read by HeldItemView for animation

  private stateTimer = 0;
  private throwCooldown = 0;

  update(
    delta: number,
    camera: THREE.Camera,
    pickup: PickupSystem,
    hitscan: HitscanSystem,
    arena: ArenaScene,
    heldView: HeldItemView,
    extraTargets: THREE.Object3D[],
    meleePressed: boolean,
    throwPressed: boolean,
    events: WeaponEvents = {},
  ): void {
    this.stateTimer = Math.max(0, this.stateTimer - delta);
    this.throwCooldown = Math.max(0, this.throwCooldown - delta);

    if (this.stateTimer === 0 && this.state !== "idle") {
      this.state = "idle";
      this.swingT = 0;
    }

    const held = pickup.held;

    // ── Melee ─────────────────────────────────────────────────────────────────
    if (meleePressed && held && this.state === "idle") {
      this.state = "swinging";
      this.stateTimer = MELEE_SWING_T + MELEE_COOLDOWN;
      this.swingT = 0;

      const origin = new THREE.Vector3();
      const dir = new THREE.Vector3();
      camera.getWorldPosition(origin);
      camera.getWorldDirection(dir);

      const result = hitscan.cast(origin, dir, arena, extraTargets);

      if (result.hit && result.distance <= MELEE_RANGE) {
        events.onMeleeHit?.(result);
        pickup.consume();
        heldView.hide();
      } else {
        // Miss — chair stays in hand, just play the swing animation
        events.onMeleeMiss?.();
      }
    }

    // Swing animation progress
    if (this.state === "swinging") {
      const progress = 1 - this.stateTimer / (MELEE_SWING_T + MELEE_COOLDOWN);
      this.swingT = Math.sin(Math.min(progress, 1) * Math.PI);
    }

    // ── Throw ─────────────────────────────────────────────────────────────────
    if (
      throwPressed &&
      held &&
      this.state === "idle" &&
      this.throwCooldown === 0
    ) {
      this.throwCooldown = THROW_COOLDOWN;

      const origin = new THREE.Vector3();
      const dir = new THREE.Vector3();
      camera.getWorldPosition(origin);
      camera.getWorldDirection(dir);

      const result = hitscan.castFromCamera(camera, arena, extraTargets);
      const to = result.hit
        ? result.point.clone()
        : origin.clone().addScaledVector(dir, 50);

      // Clone from the full-scale chair mesh (not the held-view mesh which is 0.55×)
      const meshClone = held.chair.mesh.clone();

      pickup.consume();
      heldView.hide();

      events.onThrowLaunch?.({
        from: origin.clone(),
        to,
        meshClone,
        hit: result.hit,
        result: result.hit ? result : undefined,
      });
    }
  }
}
