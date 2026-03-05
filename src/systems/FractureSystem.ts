import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { PhysicsSystem } from './PhysicsSystem';
import { buildFractureGeometries } from '../utils/FractureGeometryBuilder';
import { MAX_FRACTURE_PIECES, PIECES_PER_CHAIR } from '../utils/Constants';

const PHYSICS_LIFETIME = 2.0; // seconds with active physics before freezing

interface FracturePiece {
  mesh:     THREE.Mesh;
  body:     RAPIER.RigidBody | null;
  lifetime: number;
  active:   boolean;
  /** Piece centroid in model space — used to offset spawn position */
  centroid: THREE.Vector3;
}

export class FractureSystem {
  private pool:   FracturePiece[] = [];
  private active: FracturePiece[] = [];

  private scene!:   THREE.Scene;
  private physics!: PhysicsSystem;

  /** Per-piece geometries and shared material — built once from the chair GLB. */
  private pieceGeos:     THREE.BufferGeometry[] = [];
  private pieceCentroids: THREE.Vector3[]       = [];
  private pieceMaterial:  THREE.Material | THREE.Material[] = new THREE.MeshLambertMaterial({ color: 0xa0724a });

  /**
   * Call after Chair.loadPrototype so we have the raw geometry.
   * Pass the prototype at scale (1,1,1) — Chair.computedScale is applied at spawn time.
   */
  buildFromPrototype(
    prototype: THREE.Object3D,
    scene: THREE.Scene,
    physics: PhysicsSystem,
  ): void {
    this.scene   = scene;
    this.physics = physics;

    const result = buildFractureGeometries(prototype, PIECES_PER_CHAIR);
    this.pieceGeos      = result.geometries;
    this.pieceCentroids = result.centroids;
    this.pieceMaterial  = result.material;

    this.buildPool();
  }

  private buildPool(): void {
    const slotsPerPiece = Math.floor(MAX_FRACTURE_PIECES / PIECES_PER_CHAIR);

    for (let slot = 0; slot < slotsPerPiece; slot++) {
      for (let p = 0; p < PIECES_PER_CHAIR; p++) {
        const geo  = this.pieceGeos[p] ?? new THREE.BufferGeometry();
        const mesh = new THREE.Mesh(geo, this.pieceMaterial);
        mesh.castShadow    = true;
        mesh.receiveShadow = true;
        mesh.visible       = false;
        this.scene.add(mesh);
        this.pool.push({
          mesh,
          body:     null,
          lifetime: 0,
          active:   false,
          centroid: this.pieceCentroids[p]?.clone() ?? new THREE.Vector3(),
        });
      }
    }
  }

  /**
   * Fracture a chair at `point` on surface `impactNormal`.
   * `chairScale` should be Chair.computedScale.
   */
  fracture(
    point: THREE.Vector3,
    impactNormal: THREE.Vector3,
    chairScale: THREE.Vector3,
  ): void {
    for (let i = 0; i < PIECES_PER_CHAIR; i++) {
      const piece = this.acquire();
      if (!piece) return;

      // Apply the same scale the intact chair used
      piece.mesh.scale.copy(chairScale);

      // Spawn position = impact point + scaled centroid offset so each piece
      // appears roughly where it sat on the intact chair
      const scaledCentroid = piece.centroid.clone().multiply(chairScale);
      piece.mesh.position.copy(point).add(scaledCentroid);
      piece.mesh.position.y = Math.max(piece.mesh.position.y, 0.05);

      piece.mesh.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
      );
      piece.mesh.visible = true;

      // Scatter velocity: blend impact normal + random spread
      const speed = 2.0 + Math.random() * 5.0;
      const scatter = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        0.3 + Math.random(),
        (Math.random() - 0.5) * 2,
      );
      const vel = impactNormal.clone().multiplyScalar(0.6).add(scatter).normalize().multiplyScalar(speed);

      const angVel = {
        x: (Math.random() - 0.5) * 18,
        y: (Math.random() - 0.5) * 18,
        z: (Math.random() - 0.5) * 18,
      };

      const pos = piece.mesh.position;
      piece.body = this.physics.createDynamicBody(
        { x: pos.x, y: pos.y, z: pos.z },
        { x: vel.x, y: vel.y, z: vel.z },
        angVel,
      );

      piece.lifetime = PHYSICS_LIFETIME;
      piece.active   = true;
      this.active.push(piece);
    }
  }

  update(delta: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.lifetime -= delta;

      if (p.body) {
        if (p.lifetime <= 0) {
          this.physics.removeBody(p.body);
          p.body = null;
        } else {
          const t = p.body.translation();
          const r = p.body.rotation();
          p.mesh.position.set(t.x, t.y, t.z);
          p.mesh.quaternion.set(r.x, r.y, r.z, r.w);
        }
      }
      // Piece stays visible after freezing (persistent debris)
    }
  }

  private acquire(): FracturePiece | null {
    if (this.pool.length > 0) return this.pool.pop()!;

    // Pool empty — recycle oldest active piece
    if (this.active.length === 0) return null;
    const oldest = this.active.shift()!;
    if (oldest.body) { this.physics.removeBody(oldest.body); oldest.body = null; }
    oldest.mesh.visible = false;
    oldest.active       = false;
    return oldest;
  }
}
