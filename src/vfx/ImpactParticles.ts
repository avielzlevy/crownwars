import * as THREE from 'three';

const PARTICLE_COUNT  = 12;
const PARTICLE_LIFE   = 0.45;
const PARTICLE_SPEED  = 4.5;
const PARTICLE_SIZE   = 0.06;

interface Particle {
  mesh:     THREE.Mesh;
  velocity: THREE.Vector3;
  life:     number;
}

const _geo = new THREE.SphereGeometry(PARTICLE_SIZE, 4, 4);

export class ImpactParticles {
  private pool: Particle[] = [];
  private active: Particle[] = [];

  constructor(scene: THREE.Scene) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xddccaa, transparent: true });
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const m = new THREE.Mesh(_geo, mat.clone());
      m.visible = false;
      scene.add(m);
      this.pool.push({ mesh: m, velocity: new THREE.Vector3(), life: 0 });
    }
  }

  burst(point: THREE.Vector3, normal: THREE.Vector3): void {
    for (let i = 0; i < 6; i++) {
      const p = this.pool.pop();
      if (!p) return;

      // Random hemisphere around the surface normal
      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
      ).normalize();
      if (dir.dot(normal) < 0) dir.negate();

      p.velocity.copy(dir).multiplyScalar(PARTICLE_SPEED * (0.5 + Math.random()));
      p.mesh.position.copy(point);
      p.mesh.visible = true;
      p.life         = PARTICLE_LIFE;
      this.active.push(p);
    }
  }

  update(delta: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.life -= delta;

      if (p.life <= 0) {
        p.mesh.visible = false;
        this.active.splice(i, 1);
        this.pool.push(p);
        continue;
      }

      p.mesh.position.addScaledVector(p.velocity, delta);
      p.velocity.y -= 12 * delta; // gravity drag

      const t = 1 - p.life / PARTICLE_LIFE;
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t;
    }
  }
}
