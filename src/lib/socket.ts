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

    // Join personal room for buddy sharing
    socket.on('join-user', (userId: string) => {
      socket.join(`user-${userId}`);
      console.log(`[socket]: Socket ${socket.id} joined user-${userId}`);
    });

    // Handle live location sharing
    socket.on('update-location', async (data: { userId: string, lat: number, lng: number, institutionId: string }) => {
      // 1. Always broadcast to institution's security/admin room if they are on the map
      io.to(`institution-${data.institutionId}`).emit('live-location-update', data);

      // 2. Broadcast to buddies who have an active sharing relationship
      // For performance, we could cache buddy lists, but for now we'll just broadcast to the institution
      // and let the frontend filter, or we can fetch buddies here if needed.
      // Let's broadcast to the institution-room but with a specific event.
      // Security officers in that institution will see it.
    });

    // Join global super admin room
    socket.on('join-super-admin', () => {
      socket.join('super-admin-room');
      console.log(`[socket]: Socket ${socket.id} joined super-admin-room`);
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
    // Also broadcast to super admins so they see all platform activity globally
    io.to('super-admin-room').emit(event, data);
  }
};
