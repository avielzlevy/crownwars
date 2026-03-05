/**
 * Shared type contracts for client ↔ server Socket.io messages.
 * Both the client (src/) and server (server/) import from this file.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// ─── Server → Client ─────────────────────────────────────────────────────────

export interface S_GameState {
  tick: number;
  players: S_PlayerState[];
  chairs: S_ChairState[];
}

export interface S_PlayerState {
  id: string;
  name: string;
  shirtColor?: number; // hex integer, e.g. 0x3b82f6
  position: Vec3;
  rotation: Vec3; // euler YXZ (yaw, pitch, roll)
  heldItemId: string | null;
  health: number;
}

export interface S_ChairState {
  id: string;
  position: Vec3;
  broken: boolean;
}

export interface S_HitConfirmed {
  shooterId: string;
  targetId: string;
  damage: number;
  point: Vec3;
}

/** Server relays fractures from the shooter to all other clients. */
export interface S_FractureEvent {
  point: Vec3;
  normal: Vec3;
}

/** Sent once to a joining client so they can reconstruct existing state. */
export interface S_InitialState {
  yourId: string;
  players: S_PlayerState[];
  chairs: S_ChairState[];
}

// ─── Client → Server ─────────────────────────────────────────────────────────

export interface C_PlayerInput {
  tick: number;
  name?: string;
  shirtColor?: number;
  position: Vec3;
  rotation: Vec3;
}

export interface C_FractureNotify {
  point: Vec3;
  normal: Vec3;
}

export interface C_HitNotify {
  targetId: string;
  damage: number;
  point: Vec3;
}

// ─── Shared constants ─────────────────────────────────────────────────────────

/** Fixed chair spawn positions (x, z). Used by both client and server. */
export const CHAIR_POSITIONS: { x: number; z: number }[] = [
  { x: 15, z: 0 },
  { x: -15, z: 0 },
  { x: 0, z: 13 },
  { x: 0, z: -13 },
  { x: 11, z: 11 },
  { x: -11, z: 11 },
  { x: 11, z: -11 },
  { x: -11, z: -11 },
];

// ─── Socket event maps ────────────────────────────────────────────────────────

export interface ServerToClientEvents {
  initialState: (state: S_InitialState) => void;
  gameState: (state: S_GameState) => void;
  playerJoined: (player: S_PlayerState) => void;
  playerLeft: (id: string) => void;
  fracture: (event: S_FractureEvent) => void;
  hitConfirmed: (hit: S_HitConfirmed) => void;
  chairPickedUp: (chairId: string) => void;
}

export interface ClientToServerEvents {
  playerInput: (input: C_PlayerInput) => void;
  fractureNotify: (event: C_FractureNotify) => void;
  hitNotify: (hit: C_HitNotify) => void;
  pickupRequest: (chairId: string) => void;
}
