const { Server } = require("socket.io");

let io;

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      methods: ["GET", "POST", "PATCH"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on("joinWorkspace", (workspaceId) => {
      if (!workspaceId) {
        return;
      }

      socket.join(`workspace:${workspaceId}`);

      console.log(
        `Socket ${socket.id} joined workspace:${workspaceId}`
      );
    });

    socket.on("leaveWorkspace", (workspaceId) => {
      if (!workspaceId) {
        return;
      }

      socket.leave(`workspace:${workspaceId}`);

      console.log(
        `Socket ${socket.id} left workspace:${workspaceId}`
      );
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO has not been initialized.");
  }

  return io;
};

module.exports = {
  initializeSocket,
  getIO,
};