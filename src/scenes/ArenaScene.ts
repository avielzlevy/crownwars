import * as THREE from 'three';
import { ARENA_HALF_X, ARENA_HALF_Z, ARENA_WALL_H } from '../utils/Constants';

/**
 * Placeholder Yamit 2000–inspired arena.
 * Geometry will be swapped for a real GLTF once the model is ready.
 * The collidable surfaces (floor + walls) are exposed as `colliders`.
 */
export class ArenaScene {
  readonly root = new THREE.Group();
  /** Meshes that hitscan raycasters should test against. */
  readonly colliders: THREE.Mesh[] = [];

  private waterMesh?: THREE.Mesh;
  private waterTime = 0;

  build(scene: THREE.Scene): void {
    scene.add(this.root);
    this.buildLighting(scene);
    this.buildFloor();
    this.buildCeiling();
    this.buildDecorativeElements();
  }

  update(delta: number): void {
    if (!this.waterMesh) return;
    this.waterTime += delta;
    const mat = this.waterMesh.material as THREE.MeshPhongMaterial;
    mat.opacity = 0.78 + Math.sin(this.waterTime * 1.4) * 0.08;
    mat.color.setHSL(0.565 + Math.sin(this.waterTime * 0.3) * 0.015, 0.88, 0.52);
  }

  private buildLighting(scene: THREE.Scene): void {
    // Ambient fill
    const ambient = new THREE.AmbientLight(0xffeedd, 0.6);
    scene.add(ambient);

    // Bright overhead sun (outdoor waterpark feel)
    const sun = new THREE.DirectionalLight(0xfff5e0, 1.4);
    sun.position.set(10, 20, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far  = 100;
    sun.shadow.camera.left = sun.shadow.camera.bottom = -35;
    sun.shadow.camera.right = sun.shadow.camera.top   =  35;
    scene.add(sun);

    // Bounce light from the pool (blue-ish)
    const pool = new THREE.PointLight(0x60b8ff, 1.2, 30, 2);
    pool.position.set(0, 0.3, 0);
    scene.add(pool);

    // Fog for depth
    scene.fog = new THREE.Fog(0xd4eeff, 20, 80);
    scene.background = new THREE.Color(0x87ceeb); // sky blue
  }

  private buildFloor(): void {
    const w = ARENA_HALF_X * 2;
    const d = ARENA_HALF_Z * 2;

    // Single full floor plane (sand / tile colour)
    const tileMat = new THREE.MeshLambertMaterial({ color: 0xe8dcc8 });
    const floor   = new THREE.Mesh(new THREE.PlaneGeometry(w, d), tileMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.root.add(floor);
    this.colliders.push(floor);

    // ── Round pool ──────────────────────────────────────────────────────────
    const poolR  = 7.5;   // radius in metres
    const depth  = 0.5;   // basin depth
    const rimW   = 0.22;  // rim tile width

    // Basin (sunken cylinder visible through water transparency)
    const basinGeo = new THREE.CylinderGeometry(poolR, poolR, depth, 64);
    const basinMat = new THREE.MeshLambertMaterial({ color: 0x7ecfe0 });
    const basin    = new THREE.Mesh(basinGeo, basinMat);
    basin.position.y = -depth / 2;
    this.root.add(basin);

    // Rim (flat ring of tiles around the water)
    const rimGeo = new THREE.RingGeometry(poolR, poolR + rimW, 64);
    const rimMat = new THREE.MeshLambertMaterial({ color: 0xd0e8f0 });
    const rim    = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.001;
    rim.receiveShadow = true;
    this.root.add(rim);

    // Water surface (animated in update())
    const waterGeo = new THREE.CircleGeometry(poolR - 0.04, 64);
    const waterMat = new THREE.MeshPhongMaterial({
      color:       0x29aae1,
      transparent: true,
      opacity:     0.85,
      shininess:   120,
      specular:    new THREE.Color(0xaaddff),
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.002; // slightly above floor to avoid z-fighting
    this.root.add(water);
    this.waterMesh = water;
  }

  private buildWalls(): void {
    const W = ARENA_HALF_X * 2;
    const D = ARENA_HALF_Z * 2;
    const H = ARENA_WALL_H;
    const thickness = 0.4;

    const wallMat = new THREE.MeshLambertMaterial({ color: 0xf5e6c8 }); // sandy plaster

    const wallDefs: [number, number, number, number, number][] = [
      // x, y, z, rotY, length
      [0,              H / 2,  ARENA_HALF_Z + thickness / 2, 0,            W],
      [0,              H / 2, -ARENA_HALF_Z - thickness / 2, 0,            W],
      [ ARENA_HALF_X + thickness / 2, H / 2, 0, Math.PI / 2, D],
      [-ARENA_HALF_X - thickness / 2, H / 2, 0, Math.PI / 2, D],
    ];

    for (const [x, y, z, rotY, len] of wallDefs) {
      const geo  = new THREE.BoxGeometry(len, H, thickness);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(x, y, z);
      mesh.rotation.y = rotY;
      mesh.castShadow    = true;
      mesh.receiveShadow = true;
      this.root.add(mesh);
      this.colliders.push(mesh);
    }
  }

  private buildCeiling(): void {
    // Open-air: just a high invisible ceiling for raycaster bounds
    const geo  = new THREE.BoxGeometry(ARENA_HALF_X * 2, 0.1, ARENA_HALF_Z * 2);
    const mat  = new THREE.MeshBasicMaterial({ visible: false });
    const ceil = new THREE.Mesh(geo, mat);
    ceil.position.y = ARENA_WALL_H;
    this.root.add(ceil);
    this.colliders.push(ceil);
  }

  private buildDecorativeElements(): void {
    // Colourful umbrella poles (Yamit vibes)
    const colors = [0xff4466, 0xffaa00, 0x44ccff, 0x66ff88];
    const positions = [
      [-12, 0, -8], [12, 0, -8],
      [-12, 0,  8], [12, 0,  8],
    ];

    positions.forEach(([x, , z], i) => {
      const poleGeo  = new THREE.CylinderGeometry(0.07, 0.07, 3.5, 8);
      const poleMat  = new THREE.MeshLambertMaterial({ color: 0xdddddd });
      const pole     = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x, 1.75, z);
      pole.castShadow = true;

      const capGeo = new THREE.ConeGeometry(1.4, 0.5, 8);
      const capMat = new THREE.MeshLambertMaterial({ color: colors[i % colors.length] });
      const cap    = new THREE.Mesh(capGeo, capMat);
      cap.position.set(x, 3.8, z);
      cap.castShadow = true;

      this.root.add(pole, cap);
    });

    // Lounge chair outlines (placeholder — will be replaced by crown chairs)
    const benchMat = new THREE.MeshLambertMaterial({ color: 0xaa8855 });
    for (let i = -2; i <= 2; i++) {
      const geo  = new THREE.BoxGeometry(0.6, 0.3, 1.4);
      const mesh = new THREE.Mesh(geo, benchMat);
      mesh.position.set(i * 4, 0.15, -ARENA_HALF_Z + 2.5);
      mesh.castShadow    = true;
      mesh.receiveShadow = true;
      this.root.add(mesh);
    }
  }
}
