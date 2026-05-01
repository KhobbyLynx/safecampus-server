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
      if (data.institutionId) {
        io.to(`institution-${data.institutionId}`).emit('live-location-update', data);
      }

      // 2. Broadcast directly to all active buddies receiving location from this user
      try {
        const { Buddy, User } = require('../models');
        const { Op } = require('sequelize');
        
        // Persist last known location on the user record
        await User.update(
          { last_lat: data.lat, last_lng: data.lng },
          { where: { id: data.userId } }
        );

        // Find all buddies where the current user is sharing their location
        const activeBuddies = await Buddy.findAll({
          where: {
            [Op.or]: [
              { user_id: data.userId, user_is_sharing: true },
              { buddy_id: data.userId, buddy_is_sharing: true }
            ]
          }
        });

        activeBuddies.forEach((rel: any) => {
          const targetUserId = rel.user_id === data.userId ? rel.buddy_id : rel.user_id;
          io.to(`user-${targetUserId}`).emit('live-location-update', data);
        });
      } catch (err) {
        console.error('[socket]: Error routing location update to buddies', err);
      }
    });

    // Join global super admin room
    socket.on('join-super-admin', () => {
      socket.join('super-admin-room');
      console.log(`[socket]: Socket ${socket.id} joined super-admin-room`);
    });

    // Receiver requests last known location of a specific sharer from DB
    socket.on('request-location', async (data: { targetUserId: string }) => {
      try {
        const { User } = require('../models');
        const user = await User.findByPk(data.targetUserId, {
          attributes: ['id', 'first_name', 'last_name', 'last_lat', 'last_lng']
        });
        if (user && user.last_lat != null && user.last_lng != null) {
          socket.emit('live-location-update', {
            userId: user.id,
            userName: `${user.first_name} ${user.last_name}`,
            lat: user.last_lat,
            lng: user.last_lng,
          });
          console.log(`[socket]: Served cached location for user-${data.targetUserId}`);
        } else {
          console.log(`[socket]: No cached location for user-${data.targetUserId}`);
        }
      } catch (err) {
        console.error('[socket]: request-location error', err);
      }
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

export const emitToUser = (userId: string, event: string, data: any) => {
  if (io) {
    io.to(`user-${userId}`).emit(event, data);
  }
};
