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

  private textureLoader = new THREE.TextureLoader();

  build(scene: THREE.Scene): void {
    scene.add(this.root);
    this.buildLighting(scene);
    this.buildFloor();
    this.buildWalls();
    this.buildCeiling();
    this.buildDecorativeElements();
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
    const w  = ARENA_HALF_X * 2;
    const d  = ARENA_HALF_Z * 2;
    const pw = w * 0.42;   // pool width
    const pd = d * 0.42;   // pool depth

    const tileMat = new THREE.MeshLambertMaterial({ color: 0xe8dcc8 });

    // Four tile panels that leave a rectangular gap for the pool.
    // Each panel is a PlaneGeometry (zero thickness — no z-fighting).
    const panels: [number, number, number, number][] = [
      // panelW, panelD, centerX, centerZ
      [(w - pw) / 2, d,          -(ARENA_HALF_X + pw / 2) / 2 - pw / 4 + (w - pw) / 4, 0],  // left strip
      [(w - pw) / 2, d,           (ARENA_HALF_X + pw / 2) / 2 + pw / 4 - (w - pw) / 4, 0],  // right strip
      [pw,           (d - pd) / 2, 0,  (ARENA_HALF_Z + pd / 2) / 2 + pd / 4 - (d - pd) / 4], // front strip
      [pw,           (d - pd) / 2, 0, -(ARENA_HALF_Z + pd / 2) / 2 - pd / 4 + (d - pd) / 4], // back strip
    ];

    // Recompute with exact values for clarity
    const lw = (w - pw) / 2;
    const sh = (d - pd) / 2;

    const exactPanels: [number, number, number, number][] = [
      [lw, d,  -(pw / 2 + lw / 2), 0 ],  // left
      [lw, d,   (pw / 2 + lw / 2), 0 ],  // right
      [pw, sh,  0,  (pd / 2 + sh / 2)],  // far (north)
      [pw, sh,  0, -(pd / 2 + sh / 2)],  // near (south)
    ];

    for (const [pw2, pd2, cx, cz] of exactPanels) {
      const geo   = new THREE.PlaneGeometry(pw2, pd2);
      const plane = new THREE.Mesh(geo, tileMat);
      plane.rotation.x = -Math.PI / 2;
      plane.position.set(cx, 0, cz);
      plane.receiveShadow = true;
      this.root.add(plane);
      this.colliders.push(plane);
    }

    // Pool: sunken basin visible through the gap
    // Water surface plane sits at y = -0.02 (just below tile level — looks sunken)
    const waterGeo = new THREE.PlaneGeometry(pw, pd);
    const waterMat = new THREE.MeshLambertMaterial({ color: 0x29aae1, transparent: true, opacity: 0.88 });
    const water    = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.02;
    this.root.add(water);

    // Pool walls (4 thin boxes forming the basin rim, flush with tiles at top)
    const wallMat  = new THREE.MeshLambertMaterial({ color: 0xd0e8f0 });
    const depth    = 0.6;
    const thick    = 0.08;
    const poolWallDefs: [number, number, number, number, number][] = [
      // w, h, d, x, z
      [pw + thick * 2, depth, thick, 0,           pd / 2 + thick / 2],
      [pw + thick * 2, depth, thick, 0,          -pd / 2 - thick / 2],
      [thick,          depth, pd,    pw / 2 + thick / 2,  0],
      [thick,          depth, pd,   -pw / 2 - thick / 2,  0],
    ];
    for (const [bw, bh, bd, bx, bz] of poolWallDefs) {
      const geo  = new THREE.BoxGeometry(bw, bh, bd);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(bx, -depth / 2, bz);
      mesh.receiveShadow = true;
      this.root.add(mesh);
    }

    // Grid lines on tile area only (grid covers whole arena but only visible above tiles)
    const gridHelper = new THREE.GridHelper(Math.max(w, d), Math.max(w, d) / 2, 0xbbbbbb, 0xcccccc);
    gridHelper.position.y = 0.002;
    this.root.add(gridHelper);
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
