import { io } from 'socket.io-client';

const URL = import.meta.env.VITE_SERVER_URL || undefined;

export const socket = io(URL, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
});
