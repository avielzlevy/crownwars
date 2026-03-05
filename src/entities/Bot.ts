import * as THREE from 'three';

export type BotState = 'idle' | 'chasing' | 'attacking' | 'stunned' | 'dead';

const FLASH_DURATION  = 0.18;
const STUN_DURATION   = 0.4;
const ATTACK_RANGE    = 2.0;   // metres — switch to attacking state
const CHASE_SPEED     = 2.8;   // m/s

const SKIN_COLOR = 0x4a8f4a;   // green tint to distinguish from player-coloured dummies

export class Bot {
  readonly root     = new THREE.Group();
  readonly collider: THREE.Mesh;
  health   = 100;
  state:   BotState = 'idle';
  id: string;

  private meshes:      THREE.Mesh[] = [];
  private flashTimer   = 0;
  private stunTimer    = 0;
  private wobbleTimer  = 0;
  private legTimer     = 0; // leg swing phase

  // Current navmesh path
  path:    THREE.Vector3[] = [];
  private velocity = new THREE.Vector3();

  constructor(position: THREE.Vector3, id: string) {
    this.id = id;
    this.root.position.copy(position);
    this.buildVisual();

    const colGeo = new THREE.BoxGeometry(0.5, 1.8, 0.35);
    const colMat = new THREE.MeshBasicMaterial({ visible: false });
    this.collider = new THREE.Mesh(colGeo, colMat);
    this.collider.position.y = 0.9;
    (this.collider as THREE.Mesh & { isBot: boolean; bot: Bot }).isBot = true;
    (this.collider as THREE.Mesh & { isBot: boolean; bot: Bot }).bot   = this;
    this.root.add(this.collider);
  }

  private buildVisual(): void {
    const mat = () =>
      new THREE.MeshLambertMaterial({ color: SKIN_COLOR });

    const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number): THREE.Mesh => {
      const m = new THREE.Mesh(geo, mat());
      m.position.set(x, y, z);
      m.castShadow = true;
      this.root.add(m);
      this.meshes.push(m);
      return m;
    };

    add(new THREE.BoxGeometry(0.42, 0.6, 0.28),  0, 1.0,  0); // torso
    add(new THREE.SphereGeometry(0.16, 8, 8),     0, 1.58, 0); // head
    add(new THREE.BoxGeometry(0.12, 0.5, 0.12), -0.29, 1.0, 0); // L arm
    add(new THREE.BoxGeometry(0.12, 0.5, 0.12),  0.29, 1.0, 0); // R arm
    add(new THREE.BoxGeometry(0.16, 0.55, 0.18), -0.13, 0.38, 0); // L leg
    add(new THREE.BoxGeometry(0.16, 0.55, 0.18),  0.13, 0.38, 0); // R leg
  }

  onHit(damage: number): void {
    if (this.state === 'dead') return;
    this.health = Math.max(0, this.health - damage);
    this.flashTimer  = FLASH_DURATION;
    this.wobbleTimer = 0.3;

    for (const m of this.meshes) {
      (m.material as THREE.MeshLambertMaterial).color.set(0xff2222);
    }

    if (this.health <= 0) {
      this.die();
    } else {
      this.state     = 'stunned';
      this.stunTimer = STUN_DURATION;
    }
  }

  private die(): void {
    this.state = 'dead';
    this.path  = [];
    // Tip over sideways
    this.root.rotation.z = Math.PI / 2;
    this.root.position.y = 0.25;
    for (const m of this.meshes) {
      (m.material as THREE.MeshLambertMaterial).color.set(0x888888);
    }
  }

  update(delta: number, playerPos: THREE.Vector3): void {
    if (this.state === 'dead') return;

    // ── Flash decay ────────────────────────────────────────────────────────
    if (this.flashTimer > 0) {
      this.flashTimer -= delta;
      if (this.flashTimer <= 0) {
        for (const m of this.meshes) {
          (m.material as THREE.MeshLambertMaterial).color.set(SKIN_COLOR);
        }
      }
    }

    // ── Stun ──────────────────────────────────────────────────────────────
    if (this.state === 'stunned') {
      this.stunTimer -= delta;
      const t = this.stunTimer / STUN_DURATION;
      this.root.rotation.z = Math.sin(t * Math.PI * 3) * 0.2;
      if (this.stunTimer <= 0) {
        this.root.rotation.z = 0;
        this.state = 'chasing';
      }
      return;
    }

    // ── Wobble on hit ──────────────────────────────────────────────────────
    if (this.wobbleTimer > 0) {
      this.wobbleTimer -= delta;
      if (this.wobbleTimer <= 0) this.root.rotation.z = 0;
    }

    // ── Determine state by distance to player ─────────────────────────────
    const distToPlayer = this.root.position.distanceTo(playerPos);
    if (distToPlayer <= ATTACK_RANGE) {
      this.state = 'attacking';
    } else {
      this.state = 'chasing';
    }

    // ── Move along path ───────────────────────────────────────────────────
    if (this.state === 'chasing' && this.path.length > 0) {
      const target = this.path[0];
      const toTarget = new THREE.Vector3(
        target.x - this.root.position.x,
        0,
        target.z - this.root.position.z,
      );
      const dist = toTarget.length();

      if (dist < 0.3) {
        this.path.shift(); // reached this waypoint
      } else {
        const dir = toTarget.normalize();
        this.root.position.addScaledVector(dir, CHASE_SPEED * delta);

        // Face movement direction
        this.root.rotation.y = Math.atan2(dir.x, dir.z);

        // Leg swing animation
        this.legTimer += delta * 8;
        const swing = Math.sin(this.legTimer) * 0.4;
        if (this.meshes[4]) this.meshes[4].rotation.x =  swing;
        if (this.meshes[5]) this.meshes[5].rotation.x = -swing;
        // Arm counter-swing
        if (this.meshes[2]) this.meshes[2].rotation.x = -swing * 0.5;
        if (this.meshes[3]) this.meshes[3].rotation.x =  swing * 0.5;
      }
    } else if (this.state === 'attacking') {
      // Face player
      const dir = new THREE.Vector3(
        playerPos.x - this.root.position.x,
        0,
        playerPos.z - this.root.position.z,
      ).normalize();
      this.root.rotation.y = Math.atan2(dir.x, dir.z);
    }
  }

  addToScene(scene: THREE.Scene): void {
    scene.add(this.root);
  }

  get position(): THREE.Vector3 {
    return this.root.position;
  }
}
