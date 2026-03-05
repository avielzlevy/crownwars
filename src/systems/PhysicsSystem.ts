import RAPIER from '@dimforge/rapier3d-compat';
import { ARENA_HALF_X, ARENA_HALF_Z, ARENA_WALL_H } from '../utils/Constants';

/**
 * Thin wrapper around the Rapier world.
 * Used exclusively for fracture piece scatter — player/bot movement is kinematic.
 */
export class PhysicsSystem {
  world!: RAPIER.World;
  private initialized = false;

  async init(): Promise<void> {
    await RAPIER.init();
    this.world = new RAPIER.World({ x: 0, y: -18, z: 0 });
    this.buildStaticArena();
    this.initialized = true;
  }

  /**
   * Static colliders that match the Three.js arena geometry so fracture
   * pieces bounce off the floor and walls instead of falling into the void.
   */
  private buildStaticArena(): void {
    const fixed = RAPIER.RigidBodyDesc.fixed();

    // Floor — large flat slab at y = 0
    const floorBody = this.world.createRigidBody(fixed);
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(ARENA_HALF_X + 2, 0.1, ARENA_HALF_Z + 2)
        .setTranslation(0, -0.1, 0)
        .setRestitution(0.3)
        .setFriction(0.7),
      floorBody,
    );

    // Four arena walls
    const wallThick = 0.4;
    const wallDefs: [number, number, number, number, number][] = [
      // hx, hy, hz, tx, tz
      [ARENA_HALF_X, ARENA_WALL_H / 2, wallThick / 2,  0,                    ARENA_HALF_Z + wallThick / 2],
      [ARENA_HALF_X, ARENA_WALL_H / 2, wallThick / 2,  0,                   -ARENA_HALF_Z - wallThick / 2],
      [wallThick / 2, ARENA_WALL_H / 2, ARENA_HALF_Z,  ARENA_HALF_X + wallThick / 2, 0],
      [wallThick / 2, ARENA_WALL_H / 2, ARENA_HALF_Z, -ARENA_HALF_X - wallThick / 2, 0],
    ];

    for (const [hx, hy, hz, tx, tz] of wallDefs) {
      const wallBody = this.world.createRigidBody(fixed);
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(hx, hy, hz)
          .setTranslation(tx, ARENA_WALL_H / 2, tz)
          .setRestitution(0.2)
          .setFriction(0.5),
        wallBody,
      );
    }
  }

  step(delta: number): void {
    if (!this.initialized) return;
    // Rapier uses a fixed timestep internally; we feed it real delta
    this.world.timestep = Math.min(delta, 0.033);
    this.world.step();
  }

  createDynamicBody(
    position: RAPIER.Vector3,
    linvel: RAPIER.Vector3,
    angvel: RAPIER.Vector3,
  ): RAPIER.RigidBody {
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .setLinvel(linvel.x, linvel.y, linvel.z)
      .setAngvel(angvel);
    const body = this.world.createRigidBody(desc);

    // Box collider sized for a chair shard
    const colDesc = RAPIER.ColliderDesc.cuboid(0.12, 0.06, 0.08)
      .setRestitution(0.35)
      .setFriction(0.6);
    this.world.createCollider(colDesc, body);

    return body;
  }

  removeBody(body: RAPIER.RigidBody): void {
    if (this.world.getRigidBody(body.handle)) {
      this.world.removeRigidBody(body);
    }
  }
}
