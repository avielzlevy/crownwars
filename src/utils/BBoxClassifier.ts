import * as THREE from 'three';
import { LARGE_PIECE_THRESHOLD } from './Constants';

export type PieceSize = 'large' | 'small';

const _box = new THREE.Box3();

export function classifyPiece(mesh: THREE.Object3D): PieceSize {
  _box.setFromObject(mesh);
  const size = new THREE.Vector3();
  _box.getSize(size);
  const longest = Math.max(size.x, size.y, size.z);
  return longest >= LARGE_PIECE_THRESHOLD ? 'large' : 'small';
}
