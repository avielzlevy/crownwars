import * as THREE from 'three';
import { PIECES_PER_CHAIR } from './Constants';

export interface FractureResult {
  geometries: THREE.BufferGeometry[];
  /** Centroid of each piece in model space — used to position pieces at their
   *  correct location on the chair when it breaks. */
  centroids:  THREE.Vector3[];
  material:   THREE.Material | THREE.Material[];
}

interface Tri {
  p:        [THREE.Vector3, THREE.Vector3, THREE.Vector3];
  n:        [THREE.Vector3, THREE.Vector3, THREE.Vector3];
  uv:       [THREE.Vector2, THREE.Vector2, THREE.Vector2];
  centroid: THREE.Vector3;
}

/**
 * Takes a loaded GLB Object3D and slices its geometry into `count` pieces
 * using Voronoi-seed triangle assignment.
 *
 * - All sub-mesh transforms are baked in so pieces are in root-relative space.
 * - Each piece geometry is re-centred around its own centroid.
 * - Call with the prototype at scale (1,1,1) — callers apply Chair.computedScale
 *   on the spawned meshes.
 */
export function buildFractureGeometries(
  source: THREE.Object3D,
  count = PIECES_PER_CHAIR,
): FractureResult {
  // ── 1. Collect all triangles across all sub-meshes ────────────────────────
  source.updateMatrixWorld(true);

  const tris: Tri[]               = [];
  let   primaryMaterial: THREE.Material | THREE.Material[] | null = null;

  source.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;

    if (!primaryMaterial) primaryMaterial = mesh.material;

    const geo    = mesh.geometry as THREE.BufferGeometry;
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const norAttr = geo.getAttribute('normal')   as THREE.BufferAttribute | undefined;
    const uvAttr  = geo.getAttribute('uv')        as THREE.BufferAttribute | undefined;
    const index   = geo.getIndex();

    const mat4    = mesh.matrixWorld;
    const normMat = new THREE.Matrix3().getNormalMatrix(mat4);

    const getPos = (i: number) =>
      new THREE.Vector3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i))
        .applyMatrix4(mat4);

    const getNor = (i: number): THREE.Vector3 => {
      if (!norAttr) return new THREE.Vector3(0, 1, 0);
      return new THREE.Vector3(norAttr.getX(i), norAttr.getY(i), norAttr.getZ(i))
        .applyMatrix3(normMat).normalize();
    };

    const getUV = (i: number): THREE.Vector2 => {
      if (!uvAttr) return new THREE.Vector2(0, 0);
      return new THREE.Vector2(uvAttr.getX(i), uvAttr.getY(i));
    };

    const faceCount = index ? index.count / 3 : posAttr.count / 3;

    for (let f = 0; f < faceCount; f++) {
      const i0 = index ? index.getX(f * 3)     : f * 3;
      const i1 = index ? index.getX(f * 3 + 1) : f * 3 + 1;
      const i2 = index ? index.getX(f * 3 + 2) : f * 3 + 2;

      const p0 = getPos(i0), p1 = getPos(i1), p2 = getPos(i2);
      tris.push({
        p: [p0, p1, p2],
        n: [getNor(i0), getNor(i1), getNor(i2)],
        uv: [getUV(i0), getUV(i1), getUV(i2)],
        centroid: p0.clone().add(p1).add(p2).divideScalar(3),
      });
    }
  });

  if (tris.length === 0) {
    console.warn('[FractureBuilder] No geometry found in source.');
    return { geometries: [], centroids: [], material: new THREE.MeshLambertMaterial({ color: 0xa0724a }) };
  }

  // ── 2. Bounding box of all centroids → place Voronoi seeds inside it ──────
  const bbox = new THREE.Box3();
  tris.forEach((t) => bbox.expandByPoint(t.centroid));
  const bmin  = bbox.min.clone();
  const bsize = new THREE.Vector3(); bbox.getSize(bsize);

  // ── 3. Generate seeds — spread across Y layers to get vertical spread ──────
  const seeds: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    seeds.push(new THREE.Vector3(
      bmin.x + Math.random() * bsize.x,
      bmin.y + ((i + 0.5) / count) * bsize.y, // stratified Y for better distribution
      bmin.z + Math.random() * bsize.z,
    ));
  }

  // ── 4. Assign triangles to nearest seed ────────────────────────────────────
  const buckets: Tri[][] = Array.from({ length: count }, () => []);

  for (const tri of tris) {
    let best = 0, bestD = Infinity;
    for (let s = 0; s < seeds.length; s++) {
      const d = seeds[s].distanceToSquared(tri.centroid);
      if (d < bestD) { bestD = d; best = s; }
    }
    buckets[best].push(tri);
  }

  // Merge any empty bucket into its nearest non-empty neighbour
  for (let i = 0; i < buckets.length; i++) {
    if (buckets[i].length === 0) {
      let nearest = -1, nearestD = Infinity;
      for (let j = 0; j < buckets.length; j++) {
        if (j === i || buckets[j].length === 0) continue;
        const d = seeds[i].distanceToSquared(seeds[j]);
        if (d < nearestD) { nearestD = d; nearest = j; }
      }
      if (nearest !== -1) {
        // Split the neighbour's triangles evenly
        const half = Math.ceil(buckets[nearest].length / 2);
        buckets[i] = buckets[nearest].splice(0, half);
      }
    }
  }

  // ── 5. Build a BufferGeometry per bucket, centred on its own centroid ──────
  const geometries: THREE.BufferGeometry[] = [];
  const centroids:  THREE.Vector3[]        = [];

  for (const bucket of buckets) {
    if (bucket.length === 0) {
      geometries.push(new THREE.BufferGeometry());
      centroids.push(new THREE.Vector3());
      continue;
    }

    // Compute this piece's centroid in model space
    const pieceCenter = new THREE.Vector3();
    bucket.forEach((t) => pieceCenter.add(t.centroid));
    pieceCenter.divideScalar(bucket.length);

    const positions: number[] = [];
    const normals:   number[] = [];
    const uvs:       number[] = [];

    for (const tri of bucket) {
      for (let v = 0; v < 3; v++) {
        // Subtract piece centroid so mesh origin = centre of the piece
        positions.push(
          tri.p[v].x - pieceCenter.x,
          tri.p[v].y - pieceCenter.y,
          tri.p[v].z - pieceCenter.z,
        );
        normals.push(tri.n[v].x, tri.n[v].y, tri.n[v].z);
        uvs.push(tri.uv[v].x, tri.uv[v].y);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal',   new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2));
    geo.computeBoundingBox();
    geo.computeBoundingSphere();

    geometries.push(geo);
    centroids.push(pieceCenter);
  }

  return {
    geometries,
    centroids,
    material: primaryMaterial ?? new THREE.MeshLambertMaterial({ color: 0xa0724a }),
  };
}
