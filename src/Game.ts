import * as THREE from "three";
import { InputSystem } from "./systems/InputSystem";
import { MovementSystem } from "./systems/MovementSystem";
import { CameraSystem } from "./systems/CameraSystem";
import { SpawnSystem } from "./systems/SpawnSystem";
import { PickupSystem } from "./systems/PickupSystem";
import { HitscanSystem } from "./systems/HitscanSystem";
import { WeaponSystem } from "./systems/WeaponSystem";
import { PhysicsSystem } from "./systems/PhysicsSystem";
import { FractureSystem } from "./systems/FractureSystem";
import { ArenaScene } from "./scenes/ArenaScene";
import { HeldItemView } from "./entities/HeldItemView";
import { Chair } from "./entities/Chair";
import { CharacterModel } from "./entities/CharacterModel";
import { RemotePlayer } from "./entities/RemotePlayer";
import { PLAYER_HEIGHT } from "./utils/Constants";
import { ThrowProjectile } from "./vfx/ThrowProjectile";
import { ImpactParticles } from "./vfx/ImpactParticles";
import { HUD } from "./ui/HUD";
import { NetworkManager } from "./net/NetworkManager";

const SERVER_URL = `http://${window.location.hostname}:3001`;
const NET_SEND_RATE = 1 / 20; // 20 Hz

export class Game {
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private clock = new THREE.Clock();

  private input = new InputSystem();
  private movement = new MovementSystem();
  private camera = new CameraSystem();
  private arena = new ArenaScene();
  private spawn = new SpawnSystem();
  private pickup = new PickupSystem();
  private hitscan = new HitscanSystem();
  private weapon = new WeaponSystem();
  private physics = new PhysicsSystem();
  private fracture = new FractureSystem();
  private net = new NetworkManager();
  private hud = new HUD();

  private heldView!: HeldItemView;
  private particles!: ImpactParticles;
  private projectiles: ThrowProjectile[] = [];
  private remotePlayers = new Map<string, RemotePlayer>();

  private running = false;
  private animId = 0;
  private ready = false;
  private tick = 0;
  private netTimer = 0;
  private playerName = "Player";
  private playerShirt = 0x3b82f6;
  private localHealth = 100;
  private dead = false;
  private deathTimer = 0;

  /** Called whenever the set of shirt colours in use by remote players changes. */
  onTakenColorsChanged: ((colors: Set<number>) => void) | null = null;

  setName(name: string): void {
    this.playerName = name || "Player";
    this.net.playerName = this.playerName;
  }

  setShirtColor(hex: number): void {
    this.playerShirt = hex;
    this.net.shirtColor = hex;
  }

  private die(): void {
    this.dead = true;
    this.deathTimer = 3;
    this.hud.showDeath(this.deathTimer);
    document.exitPointerLock();
  }

  private respawn(): void {
    this.dead = false;
    this.localHealth = 100;
    this.hud.setHealth(100);
    this.hud.hideDeath();
    // Respawn at a random edge position around the arena
    const angle = Math.random() * Math.PI * 2;
    const dist = 12;
    this.movement.state.position.set(
      Math.cos(angle) * dist,
      PLAYER_HEIGHT,
      Math.sin(angle) * dist,
    );
    this.movement.state.velocity.set(0, 0, 0);
  }

  async init(): Promise<void> {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.prepend(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.arena.build(this.scene);

    await this.spawn.init(this.scene);
    await CharacterModel.loadPrototype();

    await this.physics.init();
    if (Chair.protoMesh) {
      this.fracture.buildFromPrototype(
        Chair.protoMesh,
        this.scene,
        this.physics,
      );
    }

    this.particles = new ImpactParticles(this.scene);
    this.heldView = new HeldItemView(this.scene);

    this.input.init();

    this.renderer.domElement.addEventListener("click", () => {
      this.renderer.domElement.requestPointerLock();
    });

    window.addEventListener("resize", () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.camera.onResize();
    });

    this.ready = true;
  }

  private setupNetwork(): void {
    this.net.connect(SERVER_URL);

    // Receive existing state when we join
    this.net.on("initialState", (state) => {
      // Authoritatively set playerId from server-provided ID
      this.net.playerId = state.yourId;

      // Clean up any RemotePlayer accidentally created for our own ID
      this.removeSelfRemote();

      for (const p of state.players) {
        if (p.id === this.net.playerId) continue;
        if (!this.remotePlayers.has(p.id)) {
          this.remotePlayers.set(p.id, new RemotePlayer(p, this.scene));
        }
      }

      // Remove chairs that were already picked up before we joined
      for (const ch of state.chairs) {
        if (ch.broken) this.spawn.removeChairById(ch.id, this.scene);
      }

      this.emitTakenColors();
    });

    // Another player picked up a chair — remove it from our scene
    this.net.on("chairPickedUp", (chairId) => {
      this.spawn.removeChairById(chairId, this.scene);
    });

    // Another player joined after us
    this.net.on("playerJoined", (p) => {
      if (p.id === this.net.playerId) return; // never create self
      if (!this.remotePlayers.has(p.id)) {
        this.remotePlayers.set(p.id, new RemotePlayer(p, this.scene));
      }
    });

    // Player left
    this.net.on("playerLeft", (id) => {
      const rp = this.remotePlayers.get(id);
      if (rp) {
        rp.destroy(this.scene);
        this.remotePlayers.delete(id);
      }
    });

    // Server's 20 Hz state broadcast — update remote player positions
    this.net.on("gameState", (state) => {
      const activeIds = new Set<string>();

      for (const p of state.players) {
        // Never process our own player
        if (!this.net.playerId || p.id === this.net.playerId) continue;
        activeIds.add(p.id);

        const rp = this.remotePlayers.get(p.id);
        if (rp) {
          rp.applyState(p);
        } else {
          this.remotePlayers.set(p.id, new RemotePlayer(p, this.scene));
        }
      }

      // Reconcile: remove any remote players NOT in the current server state
      // (handles missed 'playerLeft' events and stale connections)
      for (const [id, rp] of this.remotePlayers) {
        if (!activeIds.has(id)) {
          rp.destroy(this.scene);
          this.remotePlayers.delete(id);
        }
      }

      this.emitTakenColors();
    });

    // Another client triggered a fracture — play it locally
    this.net.on("fracture", (event) => {
      const pt = new THREE.Vector3(event.point.x, event.point.y, event.point.z);
      const nor = new THREE.Vector3(
        event.normal.x,
        event.normal.y,
        event.normal.z,
      );
      this.doFracture(pt, nor, false); // false = don't re-notify server
    });

    // Hit confirmed by server
    this.net.on("hitConfirmed", (hit) => {
      if (hit.targetId === this.net.playerId) {
        this.localHealth = Math.max(0, this.localHealth - hit.damage);
        this.hud.setHealth(this.localHealth);
        if (this.localHealth <= 0 && !this.dead) this.die();
      }
    });
  }

  start(): void {
    if (!this.ready) return;
    this.running = true;
    this.hud.show();
    this.setupNetwork();
    this.clock.start();
    this.loop();
  }

  private get allEnemyColliders(): THREE.Object3D[] {
    return [...this.remotePlayers.values()].map((rp) => rp.root);
  }

  /** Trigger fracture locally and optionally notify the server. */
  private doFracture(
    point: THREE.Vector3,
    normal: THREE.Vector3,
    notify = true,
  ): void {
    this.fracture.fracture(point, normal, Chair.computedScale);
    this.particles.burst(point, normal);
    if (notify) {
      this.net.sendFracture({ point, normal });
    }
  }

  private onHitscanHit(
    object: THREE.Object3D,
    damage: number,
    point: THREE.Vector3,
  ): void {
    // Remote players — notify server
    let node: THREE.Object3D | null = object;
    while (node) {
      const tagged = node as THREE.Object3D & {
        isRemote?: boolean;
        remoteId?: string;
      };
      if (tagged.isRemote && tagged.remoteId) {
        this.net.sendHit({ targetId: tagged.remoteId, damage, point });
        return;
      }
      node = node.parent;
    }
  }

  private loop(): void {
    this.animId = requestAnimationFrame(this.loop.bind(this));
    if (!this.running) return;

    const delta = Math.min(this.clock.getDelta(), 0.05);
    this.tick++;

    if (document.pointerLockElement === this.renderer.domElement) {
      const { dx, dy } = this.input.consumeDelta();
      this.movement.applyMouseLook(dx, dy);
    } else {
      this.input.consumeDelta();
    }

    this.movement.update(this.input, delta);

    if (this.input.cameraToggle) {
      this.camera.mode = this.camera.mode === "first" ? "third" : "first";
    }

    this.camera.update(this.movement.state, this.movement.quaternion, delta);

    // F-key pickup
    if (this.input.pickupPressed && !this.pickup.held) {
      const item = this.pickup.tryPickup(
        this.movement.state.position,
        this.spawn,
        this.scene,
      );
      if (item) {
        this.heldView.show(item);
        this.hud.setHeldItem(item.label);
        this.net.sendPickup(item.chair.id);
      }
    }

    // Weapon system
    this.weapon.update(
      delta,
      this.camera.camera,
      this.pickup,
      this.hitscan,
      this.arena,
      this.heldView,
      this.allEnemyColliders,
      this.input.meleePressed,
      this.input.throwPressed,
      {
        onMeleeHit: (r) => {
          this.doFracture(r.point, r.normal);
          this.onHitscanHit(r.object, 25, r.point); // 4 hits to kill
        },
        onMeleeMiss: () => {},
        onThrowLaunch: ({ from, to, meshClone, hit, result }) => {
          const proj = new ThrowProjectile(this.scene, meshClone, from, to);
          proj.onArrive = () => {
            const normal = result?.normal ?? new THREE.Vector3(0, 1, 0);
            this.doFracture(to, normal);
            if (hit && result) this.onHitscanHit(result.object, 25, to); // 4 hits to kill
            this.projectiles = this.projectiles.filter((p) => p !== proj);
          };
          this.projectiles.push(proj);
        },
      },
    );

    // HUD reticle
    if (!this.pickup.held) {
      this.hud.setHeldItem(null);
      this.hud.setThrowReady(false);
    } else {
      this.hud.setThrowReady(this.weapon.state === "idle");
    }

    this.heldView.update(
      this.camera.camera,
      this.camera.mode,
      this.movement.state.position,
      this.weapon.swingT,
    );

    // Remote players
    for (const rp of this.remotePlayers.values()) rp.update(delta);

    // Updates
    for (const p of this.projectiles) p.update(delta);
    this.fracture.update(delta);
    this.arena.update(delta);
    this.physics.step(delta);
    this.particles.update(delta);

    // Network send at 20 Hz
    this.netTimer += delta;
    if (this.netTimer >= NET_SEND_RATE) {
      this.netTimer -= NET_SEND_RATE;
      const s = this.movement.state;
      this.net.sendInput({
        tick: this.tick,
        position: { x: s.position.x, y: s.position.y, z: s.position.z },
        rotation: {
          x: this.movement.getPitch(),
          y: this.movement.getYaw(),
          z: 0,
        },
      });
    }

    const s = this.movement.state;
    this.hud.setHealth(this.localHealth);
    this.hud.setStamina(s.stamina);
    this.hud.setDebug({
      fps: Math.round(1 / delta),
      pos: `${s.position.x.toFixed(1)}, ${s.position.y.toFixed(1)}, ${s.position.z.toFixed(1)}`,
      cam: this.camera.mode,
      held: this.pickup.held?.label ?? "none",
      online: this.net.connected
        ? `${this.remotePlayers.size + 1}p`
        : "offline",
    });

    this.input.clearActions();
    this.renderer.render(this.scene, this.camera.camera);
  }

  private emitTakenColors(): void {
    if (!this.onTakenColorsChanged) return;
    const colors = new Set(
      [...this.remotePlayers.values()].map((rp) => rp.shirtColor),
    );
    this.onTakenColorsChanged(colors);
  }

  /** Safety net: remove any RemotePlayer that was accidentally created for our own socket ID. */
  private removeSelfRemote(): void {
    if (!this.net.playerId) return;
    const self = this.remotePlayers.get(this.net.playerId);
    if (self) {
      self.destroy(this.scene);
      this.remotePlayers.delete(this.net.playerId);
    }
  }

  destroy(): void {
    this.running = false;
    cancelAnimationFrame(this.animId);
    this.net.destroy();
    this.renderer.dispose();
  }
}
