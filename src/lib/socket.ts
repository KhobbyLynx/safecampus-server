import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';

let io: SocketIOServer;

export const initSocket = (server: HttpServer) => {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*', // In production, restrict this to your frontend URL
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`[socket]: New connection: ${socket.id}`);

    // Join institution-specific room
    socket.on('join-institution', (institutionId: string) => {
      socket.join(`institution-${institutionId}`);
      console.log(`[socket]: Socket ${socket.id} joined institution-${institutionId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[socket]: Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

export const emitToInstitution = (institutionId: string, event: string, data: any) => {
  if (io) {
    io.to(`institution-${institutionId}`).emit(event, data);
  }
};
