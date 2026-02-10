import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

export function useSocket(sessionCode: string | null) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!sessionCode) return;

    const socket = io({
      path: "/api/ws",
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      socket.emit("join-session", sessionCode);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionCode]);

  const onNewSubmission = useCallback(
    (callback: (submission: unknown) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};

      socket.on("new-submission", callback);
      return () => {
        socket.off("new-submission", callback);
      };
    },
    []
  );

  const onSessionReset = useCallback(
    (callback: () => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};

      socket.on("session-reset", callback);
      return () => {
        socket.off("session-reset", callback);
      };
    },
    []
  );

  return { onNewSubmission, onSessionReset };
}
