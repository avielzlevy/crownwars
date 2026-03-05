"use strict";
/**
 * Shared type contracts for client ↔ server Socket.io messages.
 * Both the client (src/) and server (server/) import from this file.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHAIR_POSITIONS = void 0;
// ─── Shared constants ─────────────────────────────────────────────────────────
/** Fixed chair spawn positions (x, z). Used by both client and server. */
exports.CHAIR_POSITIONS = [
    { x: 15, z: 0 },
    { x: -15, z: 0 },
    { x: 0, z: 13 },
    { x: 0, z: -13 },
    { x: 11, z: 11 },
    { x: -11, z: 11 },
    { x: 11, z: -11 },
    { x: -11, z: -11 },
];
