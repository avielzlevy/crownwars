import * as THREE from 'three';
import { InputSystem }      from './systems/InputSystem';
import { MovementSystem }   from './systems/MovementSystem';
import { CameraSystem }     from './systems/CameraSystem';
import { SpawnSystem }      from './systems/SpawnSystem';
import { PickupSystem }     from './systems/PickupSystem';
import { HitscanSystem }    from './systems/HitscanSystem';
import { WeaponSystem }     from './systems/WeaponSystem';
import { PhysicsSystem }    from './systems/PhysicsSystem';
import { FractureSystem }   from './systems/FractureSystem';
import { NavMeshSystem }    from './systems/NavMeshSystem';
import { BotSystem }        from './systems/BotSystem';
import { ArenaScene }       from './scenes/ArenaScene';
import { HeldItemView }     from './entities/HeldItemView';
import { Chair }            from './entities/Chair';
import { TestDummy }        from './entities/TestDummy';
import { RemotePlayer }     from './entities/RemotePlayer';
import { ThrowProjectile }  from './vfx/ThrowProjectile';
import { ImpactParticles }  from './vfx/ImpactParticles';
import { HUD }              from './ui/HUD';
import { NetworkManager }   from './net/NetworkManager';

const DUMMY_POSITIONS = [
  new THREE.Vector3( 8,  0,  4),
  new THREE.Vector3(-8,  0,  4),
];

const BOT_POSITIONS = [
  new THREE.Vector3( 0,  0, -10),
  new THREE.Vector3(14,  0,   6),
  new THREE.Vector3(-14, 0,   6),
];

const SERVER_URL    = 'http://localhost:3001';
const NET_SEND_RATE = 1 / 20; // 20 Hz

export class Game {
  private renderer!:  THREE.WebGLRenderer;
  private scene!:     THREE.Scene;
  private clock =     new THREE.Clock();

  private input    = new InputSystem();
  private movement = new MovementSystem();
  private camera   = new CameraSystem();
  private arena    = new ArenaScene();
  private spawn    = new SpawnSystem();
  private pickup   = new PickupSystem();
  private hitscan  = new HitscanSystem();
  private weapon   = new WeaponSystem();
  private physics  = new PhysicsSystem();
  private fracture = new FractureSystem();
  private navMesh  = new NavMeshSystem();
  private bots     = new BotSystem();
  private net      = new NetworkManager();
  private hud      = new HUD();

  private heldView!:       HeldItemView;
  private particles!:      ImpactParticles;
  private dummies:         TestDummy[]      = [];
  private projectiles:     ThrowProjectile[] = [];
  private remotePlayers    = new Map<string, RemotePlayer>();

  private running   = false;
  private animId    = 0;
  private ready     = false;
  private tick      = 0;
  private netTimer  = 0;

  async init(): Promise<void> {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    document.body.prepend(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.arena.build(this.scene);

    await this.spawn.init(this.scene);

    await this.physics.init();
    if (Chair.protoMesh) {
      this.fracture.buildFromPrototype(Chair.protoMesh, this.scene, this.physics);
    }

    this.navMesh.build();
    this.bots.spawn(BOT_POSITIONS, this.scene);

    this.particles = new ImpactParticles(this.scene);
    this.heldView  = new HeldItemView(this.scene);

    for (const pos of DUMMY_POSITIONS) {
      const dummy = new TestDummy(pos);
      dummy.addToScene(this.scene);
      this.dummies.push(dummy);
    }

    this.setupNetwork();

    this.input.init();
    this.hud.show();

    this.renderer.domElement.addEventListener('click', () => {
      this.renderer.domElement.requestPointerLock();
    });

    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.camera.onResize();
    });

    this.ready = true;
  }

  private setupNetwork(): void {
    this.net.connect(SERVER_URL);

    // Receive existing state when we join
    this.net.on('initialState', (state) => {
      for (const p of state.players) {
        if (!this.remotePlayers.has(p.id)) {
          this.remotePlayers.set(p.id, new RemotePlayer(p, this.scene));
        }
      }
    });

    // Another player joined after us
    this.net.on('playerJoined', (p) => {
      if (!this.remotePlayers.has(p.id)) {
        this.remotePlayers.set(p.id, new RemotePlayer(p, this.scene));
      }
    });

    // Player left
    this.net.on('playerLeft', (id) => {
      const rp = this.remotePlayers.get(id);
      if (rp) { rp.destroy(this.scene); this.remotePlayers.delete(id); }
    });

    // Server's 20 Hz state broadcast — update remote player positions
    this.net.on('gameState', (state) => {
      for (const p of state.players) {
        if (p.id === this.net.playerId) continue; // skip self
        const rp = this.remotePlayers.get(p.id);
        if (rp) {
          rp.applyState(p);
        } else {
          this.remotePlayers.set(p.id, new RemotePlayer(p, this.scene));
        }
      }
    });

    // Another client triggered a fracture — play it locally
    this.net.on('fracture', (event) => {
      const pt  = new THREE.Vector3(event.point.x,  event.point.y,  event.point.z);
      const nor = new THREE.Vector3(event.normal.x, event.normal.y, event.normal.z);
      this.doFracture(pt, nor, false); // false = don't re-notify server
    });

    // Hit confirmed by server
    this.net.on('hitConfirmed', (hit) => {
      const rp = this.remotePlayers.get(hit.targetId);
      if (rp) {
        // TODO: show hit feedback on remote player (flash, health bar, etc.)
      }
    });
  }

  start(): void {
    if (!this.ready) return;
    this.running = true;
    this.clock.start();
    this.loop();
  }

  private get allEnemyColliders(): THREE.Object3D[] {
    return [
      ...this.dummies.map((d) => d.collider),
      ...this.bots.colliders,
    ];
  }

  /** Trigger fracture locally and optionally notify the server. */
  private doFracture(
    point:  THREE.Vector3,
    normal: THREE.Vector3,
    notify  = true,
  ): void {
    this.fracture.fracture(point, normal, Chair.computedScale);
    this.particles.burst(point, normal);
    if (notify) {
      this.net.sendFracture({ point, normal });
    }
  }

  private onHitscanHit(object: THREE.Object3D, damage: number, point: THREE.Vector3): void {
    // Bots
    if (this.bots.onHit(object, damage)) return;
    // Static dummies
    this.checkDummyHit(object, damage);
    // Remote players — notify server
    let node: THREE.Object3D | null = object;
    while (node) {
      const tagged = node as THREE.Object3D & { isRemote?: boolean; remoteId?: string };
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
      this.camera.mode = this.camera.mode === 'first' ? 'third' : 'first';
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
          this.onHitscanHit(r.object, 35, r.point);
        },
        onMeleeMiss: () => {},
        onThrowLaunch: ({ from, to, meshClone, hit, result }) => {
          const proj = new ThrowProjectile(this.scene, meshClone, from, to);
          proj.onArrive = () => {
            const normal = result?.normal ?? new THREE.Vector3(0, 1, 0);
            this.doFracture(to, normal);
            if (hit && result) this.onHitscanHit(result.object, 25, to);
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
      this.hud.setThrowReady(this.weapon.state === 'idle');
    }

    this.heldView.update(
      this.camera.camera,
      this.camera.mode,
      this.movement.state.position,
      this.weapon.swingT,
    );

    // AI
    this.bots.update(delta, this.movement.state.position, this.navMesh);

    // Remote players
    for (const rp of this.remotePlayers.values()) rp.update(delta);

    // Updates
    for (const p of this.projectiles) p.update(delta);
    for (const d of this.dummies)     d.update(delta);
    this.fracture.update(delta);
    this.physics.step(delta);
    this.particles.update(delta);

    // Network send at 20 Hz
    this.netTimer += delta;
    if (this.netTimer >= NET_SEND_RATE) {
      this.netTimer -= NET_SEND_RATE;
      const s = this.movement.state;
      this.net.sendInput({
        tick:     this.tick,
        position: { x: s.position.x, y: s.position.y, z: s.position.z },
        rotation: {
          x: this.movement.getPitch(),
          y: this.movement.getYaw(),
          z: 0,
        },
      });
    }

    const s = this.movement.state;
    this.hud.setStamina(s.stamina);
    this.hud.setDebug({
      fps:     Math.round(1 / delta),
      pos:     `${s.position.x.toFixed(1)}, ${s.position.y.toFixed(1)}, ${s.position.z.toFixed(1)}`,
      cam:     this.camera.mode,
      held:    this.pickup.held?.label ?? 'none',
      bots:    this.bots.bots.filter((b) => b.state !== 'dead').length,
      online:  this.net.connected ? `${this.remotePlayers.size + 1}p` : 'offline',
    });

    this.input.clearActions();
    this.renderer.render(this.scene, this.camera.camera);
  }

  private checkDummyHit(object: THREE.Object3D, damage: number): void {
    let node: THREE.Object3D | null = object;
    while (node) {
      const tagged = node as THREE.Object3D & { isDummy?: boolean; dummy?: TestDummy };
      if (tagged.isDummy && tagged.dummy) {
        tagged.dummy.onHit(damage);
        return;
      }
      node = node.parent;
    }
  }

  destroy(): void {
    this.running = false;
    cancelAnimationFrame(this.animId);
    this.net.destroy();
    this.renderer.dispose();
  }
}
