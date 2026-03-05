"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameRoom = void 0;
const NetworkTypes_1 = require("../src/net/NetworkTypes");
class GameRoom {
    io;
    roomId;
    players = new Map();
    chairs = new Map();
    /** Track actually-connected socket IDs ourselves — don't rely on io.sockets.sockets */
    connectedIds = new Set();
    TICK_RATE = 20;
    interval = null;
    constructor(io, roomId) {
        this.io = io;
        this.roomId = roomId;
    }
    start() {
        // Populate chairs with the same fixed positions used by clients
        NetworkTypes_1.CHAIR_POSITIONS.forEach((pos, i) => {
            this.chairs.set(`chair_${i}`, {
                id: `chair_${i}`,
                position: { x: pos.x, y: 0, z: pos.z },
                broken: false,
            });
        });
        this.interval = setInterval(() => this.tick(), 1000 / this.TICK_RATE);
    }
    stop() {
        if (this.interval)
            clearInterval(this.interval);
    }
    /** Purge any player records whose sockets have disconnected. */
    purgeStale() {
        for (const [id] of this.players) {
            if (!this.connectedIds.has(id)) {
                this.players.delete(id);
                this.io.to(this.roomId).emit('playerLeft', id);
                console.log('[Room] purged stale player:', id);
            }
        }
    }
    addPlayer(socket) {
        this.connectedIds.add(socket.id);
        // Purge any stale players before creating the new record
        this.purgeStale();
        const record = {
            id: socket.id,
            name: 'Player',
            shirtColor: 0x3b82f6,
            position: { x: 0, y: 1.7, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            heldItemId: null,
            health: 100,
            lastTick: 0,
        };
        this.players.set(socket.id, record);
        // Send existing state to the new player
        socket.emit('initialState', {
            yourId: socket.id,
            players: Array.from(this.players.values()).filter((p) => p.id !== socket.id),
            chairs: Array.from(this.chairs.values()),
        });
        // Tell everyone else about the newcomer
        socket.to(this.roomId).emit('playerJoined', record);
        // ── Handlers ─────────────────────────────────────────────────────────────
        socket.on('playerInput', (input) => {
            const p = this.players.get(socket.id);
            if (!p || input.tick <= p.lastTick)
                return;
            p.lastTick = input.tick;
            if (input.name !== undefined)
                p.name = input.name;
            if (input.shirtColor !== undefined)
                p.shirtColor = input.shirtColor;
            p.position = input.position;
            p.rotation = input.rotation;
        });
        socket.on('fractureNotify', (event) => {
            // Relay to all OTHER players so they see the fracture VFX
            socket.to(this.roomId).emit('fracture', {
                point: event.point,
                normal: event.normal,
            });
        });
        socket.on('hitNotify', (hit) => {
            const target = this.players.get(hit.targetId);
            if (!target)
                return;
            target.health = Math.max(0, target.health - hit.damage);
            this.io.to(this.roomId).emit('hitConfirmed', {
                shooterId: socket.id,
                targetId: hit.targetId,
                damage: hit.damage,
                point: hit.point,
            });
            // Reset health when eliminated — client handles respawn positioning
            if (target.health <= 0) {
                target.health = 100;
            }
        });
        socket.on('pickupRequest', (chairId) => {
            const chair = this.chairs.get(chairId);
            if (!chair || chair.broken)
                return;
            const p = this.players.get(socket.id);
            if (!p)
                return;
            p.heldItemId = chairId;
            chair.broken = true; // mark taken
            // Tell other clients this chair was picked up
            socket.to(this.roomId).emit('chairPickedUp', chairId);
        });
        socket.on('disconnect', () => {
            this.connectedIds.delete(socket.id);
            this.players.delete(socket.id);
            this.io.to(this.roomId).emit('playerLeft', socket.id);
            console.log('[Room] player left:', socket.id);
        });
    }
    tick() {
        // Purge any stale players every tick (safety net)
        this.purgeStale();
        if (this.players.size === 0)
            return;
        this.io.to(this.roomId).emit('gameState', {
            tick: Date.now(),
            players: Array.from(this.players.values()),
            chairs: Array.from(this.chairs.values()),
        });
    }
}
exports.GameRoom = GameRoom;
