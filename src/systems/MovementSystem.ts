import * as THREE from 'three';
import type { InputSystem } from './InputSystem';
import {
  MOVE_SPEED, SPRINT_MULTIPLIER, CROUCH_MULTIPLIER,
  JUMP_VELOCITY, GRAVITY,
  PLAYER_HEIGHT, CROUCH_HEIGHT,
  SPRINT_MAX, SPRINT_DRAIN, SPRINT_REGEN,
  ARENA_HALF_X, ARENA_HALF_Z,
} from '../utils/Constants';

export interface MovementState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  onGround: boolean;
  isCrouching: boolean;
  isSprinting: boolean;
  stamina: number;
  currentHeight: number;
}

const _dir = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();

export class MovementSystem {
  private yaw = 0;   // radians, horizontal look
  private pitch = 0; // radians, vertical look
  readonly lookDir = new THREE.Euler(0, 0, 0, 'YXZ');
  readonly quaternion = new THREE.Quaternion();

  readonly state: MovementState = {
    position:      new THREE.Vector3(0, PLAYER_HEIGHT, 0),
    velocity:      new THREE.Vector3(),
    onGround:      true,
    isCrouching:   false,
    isSprinting:   false,
    stamina:       SPRINT_MAX,
    currentHeight: PLAYER_HEIGHT,
  };

  // Mouse sensitivity (degrees per pixel)
  sensitivity = 0.0015;

  applyMouseLook(dx: number, dy: number): void {
    this.yaw   -= dx * this.sensitivity;
    this.pitch -= dy * this.sensitivity;
    this.pitch  = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
    this.lookDir.set(this.pitch, this.yaw, 0, 'YXZ');
    this.quaternion.setFromEuler(this.lookDir);
  }

  update(input: InputSystem, delta: number): void {
    const s = this.state;

    // ── Crouch ────────────────────────────────────────────────────────────────
    const wantCrouch = input.isDown('ShiftLeft') || input.isDown('ControlLeft');
    s.isCrouching = wantCrouch;
    const targetH  = wantCrouch ? CROUCH_HEIGHT : PLAYER_HEIGHT;
    s.currentHeight = THREE.MathUtils.lerp(s.currentHeight, targetH, Math.min(1, delta * 12));

    // ── Sprint ────────────────────────────────────────────────────────────────
    const wantSprint = input.isDown('ShiftLeft') && !wantCrouch;
    if (wantSprint && s.stamina > 0) {
      s.isSprinting = true;
      s.stamina     = Math.max(0, s.stamina - SPRINT_DRAIN * delta);
    } else {
      s.isSprinting = false;
      s.stamina     = Math.min(SPRINT_MAX, s.stamina + SPRINT_REGEN * delta);
    }

    // ── Horizontal movement ───────────────────────────────────────────────────
    _forward.set(0, 0, -1).applyQuaternion(this.quaternion);
    _forward.y = 0;
    _forward.normalize();
    _right.set(1, 0, 0).applyQuaternion(this.quaternion);
    _right.y = 0;
    _right.normalize();

    _dir.set(0, 0, 0);
    if (input.isDown('KeyW') || input.isDown('ArrowUp'))    _dir.add(_forward);
    if (input.isDown('KeyS') || input.isDown('ArrowDown'))  _dir.sub(_forward);
    if (input.isDown('KeyA') || input.isDown('ArrowLeft'))  _dir.sub(_right);
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) _dir.add(_right);
    if (_dir.lengthSq() > 0) _dir.normalize();

    let speed = MOVE_SPEED;
    if (s.isSprinting) speed *= SPRINT_MULTIPLIER;
    if (s.isCrouching) speed *= CROUCH_MULTIPLIER;

    s.velocity.x = _dir.x * speed;
    s.velocity.z = _dir.z * speed;

    // ── Jump ──────────────────────────────────────────────────────────────────
    if ((input.isDown('Space')) && s.onGround) {
      s.velocity.y = JUMP_VELOCITY;
      s.onGround   = false;
    }

    // ── Gravity ───────────────────────────────────────────────────────────────
    if (!s.onGround) {
      s.velocity.y += GRAVITY * delta;
    }

    // ── Integrate ────────────────────────────────────────────────────────────
    s.position.addScaledVector(s.velocity, delta);

    // ── Floor collision ───────────────────────────────────────────────────────
    const floorY = s.currentHeight * 0.5; // eye height = half body
    if (s.position.y <= floorY) {
      s.position.y = floorY;
      s.velocity.y = 0;
      s.onGround   = true;
    } else {
      s.onGround = false;
    }

    // ── Arena wall clamp ─────────────────────────────────────────────────────
    const margin = 0.4;
    s.position.x = Math.max(-(ARENA_HALF_X - margin), Math.min(ARENA_HALF_X - margin, s.position.x));
    s.position.z = Math.max(-(ARENA_HALF_Z - margin), Math.min(ARENA_HALF_Z - margin, s.position.z));
  }

  getYaw(): number   { return this.yaw; }
  getPitch(): number { return this.pitch; }
}
