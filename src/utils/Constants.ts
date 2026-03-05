// ─── Tuning knobs ────────────────────────────────────────────────────────────

/** Bounding-box longest axis (metres) above which a piece can be used as melee. */
export const LARGE_PIECE_THRESHOLD = 0.5;

/** Maximum fracture piece meshes kept alive at any time. Oldest recycled first. */
export const MAX_FRACTURE_PIECES = 50;

/** Number of pieces spawned per chair fracture. Must match pre-fractured model count. */
export const PIECES_PER_CHAIR = 5;

/** Radius from player centre within which F-key pickup is registered. */
export const PICKUP_RADIUS = 2.5;

// ─── Movement ────────────────────────────────────────────────────────────────
export const MOVE_SPEED        = 6;    // m/s walk
export const SPRINT_MULTIPLIER = 1.8;
export const CROUCH_MULTIPLIER = 0.45;
export const JUMP_VELOCITY     = 7;    // m/s upward impulse
export const GRAVITY           = -20;  // m/s²
export const PLAYER_HEIGHT     = 1.7;  // metres
export const CROUCH_HEIGHT     = 0.95;

// ─── Sprint stamina ──────────────────────────────────────────────────────────
export const SPRINT_MAX        = 100;
export const SPRINT_DRAIN      = 25;   // per second while sprinting
export const SPRINT_REGEN      = 15;   // per second while not sprinting

// ─── Arena ───────────────────────────────────────────────────────────────────
export const ARENA_HALF_X = 25;
export const ARENA_HALF_Z = 20;
export const ARENA_WALL_H = 6;
