import * as THREE from 'three';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type ChairState = 'intact' | 'held' | 'broken';

/**
 * Real-world target dimensions for the Crown Chair (metres).
 * Scale is computed from the GLB bounding box at load time.
 */
const TARGET_H = 0.90 * 1.25 * 1.25; // ~1.406 m
const TARGET_W = 0.40 * 1.25 * 1.25; // ~0.625 m
const TARGET_D = 0.40 * 1.25 * 1.25; // ~0.625 m

export class Chair {
  readonly id: string;
  readonly mesh: THREE.Object3D;
  state: ChairState = 'intact';

  constructor(mesh: THREE.Object3D, id: string) {
    this.mesh = mesh;
    this.id   = id;
  }

  /**
   * Per-axis scale computed at load time so the chair is exactly
   * TARGET_W × TARGET_H × TARGET_D in world space.
   */
  static computedScale = new THREE.Vector3(1, 1, 1);
  /** Vertical offset so the bottom of the scaled chair sits flush at y = 0. */
  static groundOffset  = 0;
  /** The raw (scale=1) prototype mesh — kept for fracture geometry generation. */
  static protoMesh: THREE.Object3D | null = null;

  static async loadPrototype(loader: GLTFLoader): Promise<THREE.Object3D> {
    const gltf = await loader.loadAsync('/assets/models/crownchair.glb');
    const root = gltf.scene;

    root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow    = true;
        child.receiveShadow = true;
      }
    });

    // Measure the raw (scale=1) bounding box
    root.updateMatrixWorld(true);
    const rawBox  = new THREE.Box3().setFromObject(root);
    const rawSize = new THREE.Vector3();
    rawBox.getSize(rawSize);

    // Compute per-axis scale to reach target dimensions
    Chair.computedScale.set(
      TARGET_W / rawSize.x,
      TARGET_H / rawSize.y,
      TARGET_D / rawSize.z,
    );

    // Apply scale and re-measure to get the ground offset
    root.scale.copy(Chair.computedScale);
    root.updateMatrixWorld(true);
    const scaledBox = new THREE.Box3().setFromObject(root);
    Chair.groundOffset = -scaledBox.min.y;

    // Reset — scale applied again per clone
    root.scale.set(1, 1, 1);
    root.updateMatrixWorld(true);

    Chair.protoMesh = root;
    return root;
  }

  setVisible(v: boolean): void {
    this.mesh.visible = v;
  }
}
