import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Chair } from '../entities/Chair';
import { ARENA_HALF_X, ARENA_HALF_Z } from '../utils/Constants';

const CHAIR_COUNT = 8;

export class SpawnSystem {
  readonly chairs: Chair[] = [];
  private loader = new GLTFLoader();
  private proto: THREE.Object3D | null = null;
  private idCounter = 0;

  async init(scene: THREE.Scene): Promise<void> {
    this.proto = await Chair.loadPrototype(this.loader);

    for (let i = 0; i < CHAIR_COUNT; i++) {
      this.spawnChair(scene);
    }
  }

  private spawnChair(scene: THREE.Scene): void {
    if (!this.proto) return;

    const mesh  = this.proto.clone();
    const id    = `chair_${this.idCounter++}`;
    const chair = new Chair(mesh, id);

    // Apply per-axis scale so chair is exactly 40×90×40 cm in world space
    mesh.scale.copy(Chair.computedScale);

    // Random position inside arena (with margin from walls)
    const margin = 3;
    mesh.position.set(
      THREE.MathUtils.randFloatSpread((ARENA_HALF_X - margin) * 2),
      Chair.groundOffset,
      THREE.MathUtils.randFloatSpread((ARENA_HALF_Z - margin) * 2),
    );

    // Slightly random Y rotation for variety
    mesh.rotation.y = Math.random() * Math.PI * 2;

    scene.add(mesh);
    this.chairs.push(chair);
  }

  removeChair(chair: Chair, scene: THREE.Scene): void {
    scene.remove(chair.mesh);
    const idx = this.chairs.indexOf(chair);
    if (idx !== -1) this.chairs.splice(idx, 1);
  }

  /** Return intact chairs within radius of a world position */
  getNearbyCchairs(pos: THREE.Vector3, radius: number): Chair[] {
    const r2 = radius * radius;
    return this.chairs.filter(
      (c) => c.state === 'intact' && c.mesh.position.distanceToSquared(pos) < r2,
    );
  }
}
