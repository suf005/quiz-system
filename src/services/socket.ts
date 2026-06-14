import { io, Socket } from "socket.io-client";

// Connect to the host of the current page
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(window.location.origin, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    
    socket.on("connect", () => {
      console.log(`[DCCN Socket Client] Connected to real-time server with socket ID: ${socket?.id}`);
    });

    socket.on("connect_error", (error) => {
      console.error("[DCCN Socket Client] Connection error:", error);
    });
  }
  return socket;
}
