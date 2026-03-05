import * as THREE from 'three';
import { Pathfinding } from 'three-pathfinding';
import { ARENA_HALF_X, ARENA_HALF_Z } from '../utils/Constants';

const ZONE = 'arena';

/**
 * Wraps three-pathfinding.
 * The navmesh is built procedurally from the same arena dimensions used
 * by ArenaScene — 4 rectangular panels that leave a gap for the pool.
 */
export class NavMeshSystem {
  private pathfinding = new Pathfinding();
  private ready = false;

  build(): void {
    const geo  = this.buildNavmeshGeometry();
    const zone = Pathfinding.createZone(geo, 0.01);
    this.pathfinding.setZoneData(ZONE, zone);
    this.ready = true;
  }

  /**
   * Find a path from `from` to `to`.
   * Returns an array of waypoints, or null if no path exists.
   */
  findPath(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] | null {
    if (!this.ready) return null;
    const groupID = this.pathfinding.getGroup(ZONE, from);
    if (groupID === null) return null;
    return this.pathfinding.findPath(from, to, ZONE, groupID) ?? null;
  }

  /**
   * Clamp a position to the nearest point on the navmesh.
   * Useful for keeping bots on walkable ground after spawning.
   */
  clamp(pos: THREE.Vector3): THREE.Vector3 {
    if (!this.ready) return pos.clone();
    const groupID = this.pathfinding.getGroup(ZONE, pos);
    if (groupID === null) return pos.clone();
    const node = this.pathfinding.getClosestNode(pos, ZONE, groupID);
    if (!node) return pos.clone();
    const clamped = new THREE.Vector3();
    this.pathfinding.clampStep(pos, pos.clone().setY(0), node, ZONE, groupID, clamped);
    return clamped;
  }

  /** Build a flat triangulated mesh of the walkable floor (pool excluded). */
  private buildNavmeshGeometry(): THREE.BufferGeometry {
    const HX  = ARENA_HALF_X;
    const HZ  = ARENA_HALF_Z;
    const phx = HX * 2 * 0.42 / 2; // pool half-width
    const phz = HZ * 2 * 0.42 / 2; // pool half-depth

    // Four rectangles: [x1, z1, x2, z2]
    const rects: [number, number, number, number][] = [
      [-HX,  -HZ,  -phx,  HZ ],  // left strip
      [ phx, -HZ,   HX,   HZ ],  // right strip
      [-phx,  phz,  phx,  HZ ],  // north strip
      [-phx, -HZ,   phx, -phz],  // south strip
    ];

    const positions: number[] = [];

    for (const [x1, z1, x2, z2] of rects) {
      // Two CCW triangles per quad (y=0, flat floor)
      positions.push(
        x1, 0, z1,   x2, 0, z1,   x1, 0, z2,
        x2, 0, z1,   x2, 0, z2,   x1, 0, z2,
      );
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }
}
