import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PLAYER_HEIGHT } from '../utils/Constants';

/** GLB material name for the shirt primitive. */
const SHIRT_MAT_NAME = 'Shirt';

export class CharacterModel {
  static proto: THREE.Object3D | null = null;
  static scale = 1;
  static groundOffset = 0;

  private static loader = new GLTFLoader();

  static async loadPrototype(): Promise<void> {
    const gltf = await CharacterModel.loader.loadAsync('/assets/models/male.glb');
    const root = gltf.scene;

    root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow    = true;
        child.receiveShadow = true;
      }
    });

    // Measure raw bounding box and compute uniform scale to reach PLAYER_HEIGHT
    root.updateMatrixWorld(true);
    const box  = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    CharacterModel.scale = PLAYER_HEIGHT / size.y;

    // Apply scale and compute ground offset so feet sit at y=0
    root.scale.setScalar(CharacterModel.scale);
    root.updateMatrixWorld(true);
    const scaledBox = new THREE.Box3().setFromObject(root);
    CharacterModel.groundOffset = -scaledBox.min.y;

    // Reset — scale applied per clone
    root.scale.setScalar(1);
    CharacterModel.proto = root;
  }

  /**
   * Clone the prototype with a specific shirt colour applied.
   * The returned Group has its origin at the character's feet.
   */
  static clone(shirtColorHex = 0x3b82f6): THREE.Group {
    if (!CharacterModel.proto) {
      // Fallback box character if model hasn't loaded yet
      return CharacterModel.makeFallback(shirtColorHex);
    }

    const inner = CharacterModel.proto.clone(true);
    inner.scale.setScalar(CharacterModel.scale);
    inner.position.y = CharacterModel.groundOffset;
    inner.rotation.y = Math.PI; // Flip model to face -Z (match camera forward)

    // Deep-clone materials so shirt colour is per-instance
    inner.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((m) => {
          const cloned = (m as THREE.Material).clone();
          if (cloned.name === SHIRT_MAT_NAME && (cloned as THREE.MeshStandardMaterial).color) {
            (cloned as THREE.MeshStandardMaterial).color.setHex(shirtColorHex);
          }
          return cloned;
        });
      } else {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat.name === SHIRT_MAT_NAME) {
          mesh.material = mat.clone();
          (mesh.material as THREE.MeshStandardMaterial).color.setHex(shirtColorHex);
        }
      }
    });

    const wrapper = new THREE.Group();
    wrapper.add(inner);
    return wrapper;
  }

  /** Update just the shirt colour on an already-cloned group. */
  static applyShirtColor(root: THREE.Group, shirtColorHex: number): void {
    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (Array.isArray(mesh.material)) {
        for (const m of mesh.material) {
          if (m.name === SHIRT_MAT_NAME && (m as THREE.MeshStandardMaterial).color) {
            (m as THREE.MeshStandardMaterial).color.setHex(shirtColorHex);
          }
        }
      } else {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat.name === SHIRT_MAT_NAME && mat.color) {
          mat.color.setHex(shirtColorHex);
        }
      }
    });
  }

  private static makeFallback(shirtColorHex: number): THREE.Group {
    const g   = new THREE.Group();
    const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(geo);
      m.position.set(x, y, z);
      m.castShadow = true;
      g.add(m);
    };
    const skin  = new THREE.MeshLambertMaterial({ color: 0xffcc99 });
    const shirt = new THREE.MeshLambertMaterial({ color: shirtColorHex });
    const pants = new THREE.MeshLambertMaterial({ color: 0x334455 });
    add(new THREE.BoxGeometry(0.42, 0.6, 0.28),   0,     1.0,  0);
    add(new THREE.SphereGeometry(0.16, 8, 8),      0,     1.58, 0);
    add(new THREE.BoxGeometry(0.12, 0.5, 0.12),  -0.29,  1.0,  0);
    add(new THREE.BoxGeometry(0.12, 0.5, 0.12),   0.29,  1.0,  0);
    add(new THREE.BoxGeometry(0.16, 0.55, 0.18), -0.13,  0.38, 0);
    add(new THREE.BoxGeometry(0.16, 0.55, 0.18),  0.13,  0.38, 0);
    (g.children[0] as THREE.Mesh).material = shirt;
    (g.children[1] as THREE.Mesh).material = skin;
    (g.children[2] as THREE.Mesh).material = shirt;
    (g.children[3] as THREE.Mesh).material = shirt;
    (g.children[4] as THREE.Mesh).material = pants;
    (g.children[5] as THREE.Mesh).material = pants;
    return g;
  }
}
