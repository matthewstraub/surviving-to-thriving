import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";

let io: SocketIOServer | null = null;

export function initSocketIO(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    path: "/api/ws",
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Clients join a room named after the session code
    socket.on("join-session", (sessionCode: string) => {
      socket.join(`session:${sessionCode}`);
      console.log(`[Socket] ${socket.id} joined session:${sessionCode}`);
    });

    socket.on("disconnect", () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

/** Emit a new submission to all clients watching a session */
export function emitNewSubmission(sessionCode: string, submission: unknown) {
  if (io) {
    io.to(`session:${sessionCode}`).emit("new-submission", submission);
  }
}

/** Emit a reset event to all clients watching a session */
export function emitSessionReset(sessionCode: string) {
  if (io) {
    io.to(`session:${sessionCode}`).emit("session-reset");
  }
}
