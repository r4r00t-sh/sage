'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/lib/store';
import { API_BASE_URL } from '@/lib/api';

export function PresenceClient() {
  const socketRef = useRef<Socket | null>(null);
  const { user, token } = useAuthStore();

  useEffect(() => {
    if (!user || !token) return;

    const socket = io(`${API_BASE_URL}/presence`, {
      auth: { userId: user.id },
      transports: ['websocket'],
    });

    socketRef.current = socket;

    // Send heartbeat every 3 minutes
    const heartbeatInterval = setInterval(() => {
      socket.emit('heartbeat');
    }, 3 * 60 * 1000);

    // Initial heartbeat
    socket.emit('heartbeat');

    return () => {
      clearInterval(heartbeatInterval);
      socket.disconnect();
    };
  }, [user, token]);

  return null;
}

