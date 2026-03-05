"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameRoom = void 0;
class GameRoom {
    io;
    roomId;
    players = new Map();
    chairs = new Map();
    TICK_RATE = 20;
    interval = null;
    constructor(io, roomId) {
        this.io = io;
        this.roomId = roomId;
    }
    start() {
        this.interval = setInterval(() => this.tick(), 1000 / this.TICK_RATE);
    }
    stop() {
        if (this.interval)
            clearInterval(this.interval);
    }
    addPlayer(socket) {
        const record = {
            id: socket.id,
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
        });
        socket.on('disconnect', () => {
            this.players.delete(socket.id);
            this.io.to(this.roomId).emit('playerLeft', socket.id);
            console.log('[Room] player left:', socket.id);
        });
    }
    tick() {
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
