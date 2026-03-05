import { createServer } from 'http';
import { Server } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from '../src/net/NetworkTypes';
import { GameRoom } from './GameRoom';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

const httpServer = createServer();
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: '*' },
  pingTimeout: 3000,
  pingInterval: 1500,
});

// Single room for now — M6 will add lobby/room management
const room = new GameRoom(io, 'main');
room.start();

io.on('connection', (socket) => {
  console.log('[Server] player connected:', socket.id);
  socket.join('main');
  room.addPlayer(socket);
});

httpServer.listen(PORT, () => {
  console.log(`[Server] Crown Wars game server listening on :${PORT}`);
});
