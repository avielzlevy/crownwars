"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NetworkManager = void 0;
const socket_io_client_1 = require("socket.io-client");
/**
 * Thin wrapper around the Socket.io client.
 * If the server is unreachable, stays disconnected and all sends are no-ops.
 * The rest of the game runs fine offline.
 */
class NetworkManager {
    socket = null;
    playerId = '';
    connected = false;
    connect(serverUrl) {
        this.socket = (0, socket_io_client_1.io)(serverUrl, {
            autoConnect: true,
            reconnection: true,
            timeout: 3000,
            reconnectionAttempts: 5,
        });
        this.socket.on('connect', () => {
            this.connected = true;
            this.playerId = this.socket.id ?? '';
            console.log('[Net] connected:', this.playerId);
        });
        this.socket.on('disconnect', () => {
            this.connected = false;
            console.log('[Net] disconnected');
        });
        this.socket.on('connect_error', () => {
            // Server probably not running — stay in offline mode silently
        });
    }
    on(event, listener) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.socket?.on(event, listener);
    }
    sendInput(input) {
        if (!this.connected)
            return;
        this.socket?.emit('playerInput', input);
    }
    sendFracture(event) {
        if (!this.connected)
            return;
        this.socket?.emit('fractureNotify', event);
    }
    sendHit(hit) {
        if (!this.connected)
            return;
        this.socket?.emit('hitNotify', hit);
    }
    sendPickup(chairId) {
        if (!this.connected)
            return;
        this.socket?.emit('pickupRequest', chairId);
    }
    destroy() {
        this.socket?.disconnect();
        this.socket = null;
    }
}
exports.NetworkManager = NetworkManager;
