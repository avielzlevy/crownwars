import * as THREE from 'three';
import { Bot } from '../entities/Bot';
import type { NavMeshSystem } from './NavMeshSystem';

const PATH_UPDATE_INTERVAL = 0.45; // seconds between path recalculations

export class BotSystem {
  readonly bots: Bot[] = [];
  private pathTimer = 0;
  private idCounter = 0;

  spawn(positions: THREE.Vector3[], scene: THREE.Scene): void {
    for (const pos of positions) {
      const bot = new Bot(pos.clone(), `bot_${this.idCounter++}`);
      bot.addToScene(scene);
      this.bots.push(bot);
    }
  }

  get colliders(): THREE.Object3D[] {
    return this.bots
      .filter((b) => b.state !== 'dead')
      .map((b) => b.collider);
  }

  update(delta: number, playerPos: THREE.Vector3, navMesh: NavMeshSystem): void {
    this.pathTimer += delta;
    const shouldRepath = this.pathTimer >= PATH_UPDATE_INTERVAL;
    if (shouldRepath) this.pathTimer = 0;

    for (const bot of this.bots) {
      if (bot.state === 'dead') continue;

      // Recompute path periodically
      if (shouldRepath) {
        const path = navMesh.findPath(bot.position, playerPos);
        if (path && path.length > 0) {
          // Append player position as final waypoint
          bot.path = [...path, playerPos.clone()];
        } else {
          // Fallback: direct line if NavMesh can't find a path
          bot.path = [playerPos.clone()];
        }
      }

      bot.update(delta, playerPos);
    }
  }

  onHit(object: THREE.Object3D, damage: number): boolean {
    let node: THREE.Object3D | null = object;
    while (node) {
      const tagged = node as THREE.Object3D & { isBot?: boolean; bot?: Bot };
      if (tagged.isBot && tagged.bot) {
        tagged.bot.onHit(damage);
        return true;
      }
      node = node.parent;
    }
    return false;
  }
}
