import { io, type Socket } from 'socket.io-client';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  C_PlayerInput,
  C_FractureNotify,
  C_HitNotify,
} from './NetworkTypes';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Thin wrapper around the Socket.io client.
 * If the server is unreachable, stays disconnected and all sends are no-ops.
 * The rest of the game runs fine offline.
 */
export class NetworkManager {
  private socket: GameSocket | null = null;
  playerId    = '';
  playerName  = 'Player';
  shirtColor  = 0x3b82f6;
  connected   = false;

  connect(serverUrl: string): void {
    this.socket = io(serverUrl, {
      autoConnect:   true,
      reconnection:  true,
      timeout:       3000,
      reconnectionAttempts: 5,
    }) as GameSocket;

    this.socket.on('connect', () => {
      this.connected = true;
      this.playerId  = this.socket!.id ?? '';
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

  on<E extends keyof ServerToClientEvents>(
    event: E,
    listener: ServerToClientEvents[E],
  ): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.socket as any)?.on(event, listener);
  }

  sendInput(input: C_PlayerInput): void {
    if (!this.connected) return;
    this.socket?.emit('playerInput', { ...input, name: this.playerName, shirtColor: this.shirtColor });
  }

  sendFracture(event: C_FractureNotify): void {
    if (!this.connected) return;
    this.socket?.emit('fractureNotify', event);
  }

  sendHit(hit: C_HitNotify): void {
    if (!this.connected) return;
    this.socket?.emit('hitNotify', hit);
  }

  sendPickup(chairId: string): void {
    if (!this.connected) return;
    this.socket?.emit('pickupRequest', chairId);
  }

  destroy(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}
