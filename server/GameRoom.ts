import type { Server, Socket } from 'socket.io';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  S_PlayerState,
  S_ChairState,
  C_PlayerInput,
  C_FractureNotify,
  C_HitNotify,
} from '../src/net/NetworkTypes';

type IO   = Server<ClientToServerEvents, ServerToClientEvents>;
type Sock = Socket<ClientToServerEvents, ServerToClientEvents>;

interface PlayerRecord extends S_PlayerState {
  lastTick: number;
}

export class GameRoom {
  private players = new Map<string, PlayerRecord>();
  private chairs  = new Map<string, S_ChairState>();
  private readonly TICK_RATE = 20;
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly io: IO,
    private readonly roomId: string,
  ) {}

  start(): void {
    this.interval = setInterval(() => this.tick(), 1000 / this.TICK_RATE);
  }

  stop(): void {
    if (this.interval) clearInterval(this.interval);
  }

  addPlayer(socket: Sock): void {
    const record: PlayerRecord = {
      id:         socket.id,
      position:   { x: 0, y: 1.7, z: 0 },
      rotation:   { x: 0, y: 0, z: 0 },
      heldItemId: null,
      health:     100,
      lastTick:   0,
    };
    this.players.set(socket.id, record);

    // Send existing state to the new player
    socket.emit('initialState', {
      yourId:  socket.id,
      players: Array.from(this.players.values()).filter((p) => p.id !== socket.id),
      chairs:  Array.from(this.chairs.values()),
    });

    // Tell everyone else about the newcomer
    socket.to(this.roomId).emit('playerJoined', record);

    // ── Handlers ─────────────────────────────────────────────────────────────

    socket.on('playerInput', (input: C_PlayerInput) => {
      const p = this.players.get(socket.id);
      if (!p || input.tick <= p.lastTick) return;
      p.lastTick = input.tick;
      p.position = input.position;
      p.rotation = input.rotation;
    });

    socket.on('fractureNotify', (event: C_FractureNotify) => {
      // Relay to all OTHER players so they see the fracture VFX
      socket.to(this.roomId).emit('fracture', {
        point:  event.point,
        normal: event.normal,
      });
    });

    socket.on('hitNotify', (hit: C_HitNotify) => {
      const target = this.players.get(hit.targetId);
      if (!target) return;
      target.health = Math.max(0, target.health - hit.damage);
      this.io.to(this.roomId).emit('hitConfirmed', {
        shooterId: socket.id,
        targetId:  hit.targetId,
        damage:    hit.damage,
        point:     hit.point,
      });
    });

    socket.on('pickupRequest', (chairId: string) => {
      const chair = this.chairs.get(chairId);
      if (!chair || chair.broken) return;
      const p = this.players.get(socket.id);
      if (!p) return;
      p.heldItemId = chairId;
      chair.broken = true; // mark taken
    });

    socket.on('disconnect', () => {
      this.players.delete(socket.id);
      this.io.to(this.roomId).emit('playerLeft', socket.id);
      console.log('[Room] player left:', socket.id);
    });
  }

  private tick(): void {
    if (this.players.size === 0) return;
    this.io.to(this.roomId).emit('gameState', {
      tick:    Date.now(),
      players: Array.from(this.players.values()),
      chairs:  Array.from(this.chairs.values()),
    });
  }
}
