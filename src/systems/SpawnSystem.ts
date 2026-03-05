import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Chair } from "../entities/Chair";
import { CHAIR_POSITIONS } from "../net/NetworkTypes";

export class SpawnSystem {
  readonly chairs: Chair[] = [];
  private loader = new GLTFLoader();
  private proto: THREE.Object3D | null = null;

  async init(scene: THREE.Scene): Promise<void> {
    this.proto = await Chair.loadPrototype(this.loader);

    CHAIR_POSITIONS.forEach((pos, i) => {
      this.spawnChairAt(scene, `chair_${i}`, pos.x, pos.z);
    });
  }

  private spawnChairAt(
    scene: THREE.Scene,
    id: string,
    x: number,
    z: number,
  ): void {
    if (!this.proto) return;

    const mesh = this.proto.clone();
    const chair = new Chair(mesh, id);

    // Apply per-axis scale so chair is exactly 40×90×40 cm in world space
    mesh.scale.copy(Chair.computedScale);

    // Fixed position — same on every client
    mesh.position.set(x, Chair.groundOffset, z);

    // Deterministic rotation — face outward from center
    mesh.rotation.y = Math.atan2(z, x);

    scene.add(mesh);
    this.chairs.push(chair);
  }

  removeChair(chair: Chair, scene: THREE.Scene): void {
    scene.remove(chair.mesh);
    const idx = this.chairs.indexOf(chair);
    if (idx !== -1) this.chairs.splice(idx, 1);
  }

  /** Remove a chair by its network ID (used when the server says another player picked it up). */
  removeChairById(id: string, scene: THREE.Scene): void {
    const idx = this.chairs.findIndex((c) => c.id === id);
    if (idx === -1) return;
    const chair = this.chairs[idx];
    chair.state = "broken";
    scene.remove(chair.mesh);
    this.chairs.splice(idx, 1);
  }

  /** Return intact chairs within radius of a world position */
  getNearbyCchairs(pos: THREE.Vector3, radius: number): Chair[] {
    const r2 = radius * radius;
    return this.chairs.filter(
      (c) =>
        c.state === "intact" && c.mesh.position.distanceToSquared(pos) < r2,
    );
  }
}
