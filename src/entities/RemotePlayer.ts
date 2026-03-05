import * as THREE from 'three';
import type { S_PlayerState } from '../net/NetworkTypes';
import { PLAYER_HEIGHT } from '../utils/Constants';
import { CharacterModel } from './CharacterModel';

const LERP_SPEED = 12;
/** Server sends position.y = PLAYER_HEIGHT/2 when standing; offset root to feet. */
const Y_OFFSET   = -(PLAYER_HEIGHT / 2);

export class RemotePlayer {
  readonly root = new THREE.Group();
  readonly id:  string;

  private charRoot:    THREE.Group;
  private label?:      THREE.Sprite;
  private targetPos  = new THREE.Vector3();
  private targetYaw  = 0;
  private isMoving   = false;
  private legTimer   = 0;
  private currentName = '';
  shirtColor         = 0x3b82f6;

  constructor(state: S_PlayerState, scene: THREE.Scene) {
    this.id         = state.id;
    this.shirtColor = state.shirtColor ?? 0x3b82f6;

    this.charRoot = CharacterModel.clone(this.shirtColor);
    this.root.add(this.charRoot);

    this.currentName = state.name ?? state.id.slice(0, 6);
    this.buildLabel(this.currentName);
    this.applyState(state);

    // Invisible hitbox for reliable hitscan detection against GLB models
    const hitboxGeo = new THREE.BoxGeometry(0.8, PLAYER_HEIGHT, 0.8);
    const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitbox    = new THREE.Mesh(hitboxGeo, hitboxMat);
    hitbox.position.y = PLAYER_HEIGHT / 2;
    this.root.add(hitbox);

    // Tag all descendant meshes for hitscan detection
    this.root.traverse((child) => {
      const obj = child as THREE.Object3D & { isRemote?: boolean; remoteId?: string };
      obj.isRemote  = true;
      obj.remoteId  = state.id;
    });

    scene.add(this.root);
  }

  private buildLabel(name: string): void {
    const canvas  = document.createElement('canvas');
    canvas.width  = 256;
    canvas.height = 56;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.roundRect(4, 4, 248, 48, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font      = 'bold 26px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name.slice(0, 16), 128, 28);

    const tex  = new THREE.CanvasTexture(canvas);
    const mat  = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
    this.label = new THREE.Sprite(mat);
    this.label.scale.set(1.4, 0.31, 1);
    this.label.position.set(0, PLAYER_HEIGHT + 0.35, 0); // above head
    this.root.add(this.label);
  }

  private updateLabel(name: string): void {
    if (!this.label) return;
    const mat = this.label.material as THREE.SpriteMaterial;
    const tex = mat.map;
    if (!tex) return;
    const canvas = tex.image as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.roundRect(4, 4, 248, 48, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font      = 'bold 26px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name.slice(0, 16), 128, 28);
    tex.needsUpdate = true;
  }

  applyState(state: S_PlayerState): void {
    const prev = this.targetPos.clone();
    this.targetPos.set(state.position.x, state.position.y + Y_OFFSET, state.position.z);
    this.targetYaw = state.rotation.y;
    this.isMoving  = prev.distanceToSquared(this.targetPos) > 0.0001;

    // Update name label if it changed
    const newName = state.name ?? state.id.slice(0, 6);
    if (newName !== this.currentName) {
      this.currentName = newName;
      this.updateLabel(newName);
    }

    // Update shirt colour if it changed
    const newColor = state.shirtColor ?? 0x3b82f6;
    if (newColor !== this.shirtColor) {
      this.shirtColor = newColor;
      CharacterModel.applyShirtColor(this.charRoot, newColor);
    }
  }

  update(delta: number): void {
    // Smooth position
    this.root.position.lerp(this.targetPos, Math.min(1, LERP_SPEED * delta));

    // Smooth yaw (wrap to [-π, π]  — use double-mod to handle JS negative %)
    const dyaw    = this.targetYaw - this.root.rotation.y;
    const TWO_PI  = Math.PI * 2;
    const wrapped = ((dyaw + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI;
    this.root.rotation.y += wrapped * Math.min(1, LERP_SPEED * delta);

    // Walking animation — only applies to the fallback box character.
    // The GLB has no clip track to drive so we skip for real model.
    if (!CharacterModel.proto) {
      const meshes = this.charRoot.children as THREE.Mesh[];
      if (this.isMoving) {
        this.legTimer += delta * 8;
        const swing = Math.sin(this.legTimer) * 0.35;
        if (meshes[4]) meshes[4].rotation.x =  swing;
        if (meshes[5]) meshes[5].rotation.x = -swing;
        if (meshes[2]) meshes[2].rotation.x = -swing * 0.5;
        if (meshes[3]) meshes[3].rotation.x =  swing * 0.5;
      } else {
        if (meshes[4]) meshes[4].rotation.x = 0;
        if (meshes[5]) meshes[5].rotation.x = 0;
        if (meshes[2]) meshes[2].rotation.x = 0;
        if (meshes[3]) meshes[3].rotation.x = 0;
      }
    }
  }

  destroy(scene: THREE.Scene): void {
    scene.remove(this.root);
  }
}
