import * as THREE from 'three';

const FLASH_DURATION = 0.22; // seconds
const WOBBLE_AMP     = 0.18; // radians

/**
 * A simple humanoid test dummy.
 * Body = box, head = sphere, limbs = boxes.
 * Registered as a hitscan target; flashes red and wobbles on hit.
 */
export class TestDummy {
  readonly root:     THREE.Group;
  readonly collider: THREE.Mesh; // used by HitscanSystem
  health = 100;

  private flashTimer  = 0;
  private wobbleTimer = 0;
  private normalMat:  THREE.MeshLambertMaterial;
  private hitMat:     THREE.MeshLambertMaterial;
  private meshes:     THREE.Mesh[] = [];

  constructor(position: THREE.Vector3) {
    this.root = new THREE.Group();
    this.root.position.copy(position);

    this.normalMat = new THREE.MeshLambertMaterial({ color: 0xf0c070 });
    this.hitMat    = new THREE.MeshLambertMaterial({ color: 0xff2222 });

    this.buildMeshes();

    // Invisible collider that spans the whole body for easy raycasting
    const colGeo     = new THREE.BoxGeometry(0.5, 1.8, 0.35);
    const colMat     = new THREE.MeshBasicMaterial({ visible: false });
    this.collider    = new THREE.Mesh(colGeo, colMat);
    this.collider.position.y = 0.9;
    // Tag the collider so Game.ts can map back to this dummy
    (this.collider as THREE.Mesh & { isDummy: boolean; dummy: TestDummy }).isDummy = true;
    (this.collider as THREE.Mesh & { isDummy: boolean; dummy: TestDummy }).dummy   = this;
    this.root.add(this.collider);
  }

  private buildMeshes(): void {
    const add = (geo: THREE.BufferGeometry, y: number): THREE.Mesh => {
      const m = new THREE.Mesh(geo, this.normalMat.clone());
      m.position.y  = y;
      m.castShadow  = true;
      this.root.add(m);
      this.meshes.push(m);
      return m;
    };

    // Torso
    add(new THREE.BoxGeometry(0.42, 0.6, 0.28), 1.0);
    // Head
    add(new THREE.SphereGeometry(0.16, 8, 8), 1.58);
    // Left arm
    const la = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), this.normalMat.clone());
    la.position.set(-0.29, 1.0, 0); la.castShadow = true;
    this.root.add(la); this.meshes.push(la);
    // Right arm
    const ra = la.clone();
    ra.position.x = 0.29;
    this.root.add(ra); this.meshes.push(ra);
    // Left leg
    const ll = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.18), this.normalMat.clone());
    ll.position.set(-0.13, 0.38, 0); ll.castShadow = true;
    this.root.add(ll); this.meshes.push(ll);
    // Right leg
    const rl = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.18), this.normalMat.clone());
    rl.position.set(0.13, 0.38, 0); rl.castShadow = true;
    this.root.add(rl); this.meshes.push(rl);
  }

  onHit(damage = 25): void {
    this.health    = Math.max(0, this.health - damage);
    this.flashTimer  = FLASH_DURATION;
    this.wobbleTimer = 0.35;

    // Flash red
    for (const m of this.meshes) {
      (m.material as THREE.MeshLambertMaterial).color.set(0xff2222);
    }
  }

  update(delta: number): void {
    // Flash decay
    if (this.flashTimer > 0) {
      this.flashTimer -= delta;
      if (this.flashTimer <= 0) {
        for (const m of this.meshes) {
          (m.material as THREE.MeshLambertMaterial).color.set(0xf0c070);
        }
      }
    }

    // Wobble (lean back and recover)
    if (this.wobbleTimer > 0) {
      this.wobbleTimer -= delta;
      const t  = this.wobbleTimer / 0.35;
      this.root.rotation.z = Math.sin(t * Math.PI * 2) * WOBBLE_AMP * t;
      if (this.wobbleTimer <= 0) this.root.rotation.z = 0;
    }
  }

  addToScene(scene: THREE.Scene): void {
    scene.add(this.root);
  }
}
