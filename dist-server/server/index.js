"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const GameRoom_1 = require("./GameRoom");
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const httpServer = (0, http_1.createServer)();
const io = new socket_io_1.Server(httpServer, {
    cors: { origin: '*' },
});
// Single room for now — M6 will add lobby/room management
const room = new GameRoom_1.GameRoom(io, 'main');
room.start();
io.on('connection', (socket) => {
    console.log('[Server] player connected:', socket.id);
    socket.join('main');
    room.addPlayer(socket);
});
httpServer.listen(PORT, () => {
    console.log(`[Server] Crown Wars game server listening on :${PORT}`);
});
