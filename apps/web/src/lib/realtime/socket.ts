/**
 * Socket.IO client for the API realtime gateway (/realtime namespace).
 * Reconnects with backoff, authenticates with the current access token and
 * re-authenticates after a token refresh.
 */
'use client';

import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from '@/lib/auth/tokens';

const SOCKET_ORIGIN = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

export interface LeadMovedEvent {
  submissionId: string;
  from: string;
  to: string;
  actor: string;
}

export interface ProctorFocusLossEvent {
  attemptId: string;
  studentName: string;
  count: number;
  limit: number;
  at: string;
}

export interface SocketEvents {
  connected: { userId: string; rooms: string[] };
  'lead:moved': LeadMovedEvent;
  'proctor:focus-loss': ProctorFocusLossEvent;
  notification: { count: number };
  error: { message: string };
}

type Handler<T = unknown> = (payload: T) => void;

const handlers: Partial<Record<keyof SocketEvents, Set<Handler>>> = {};

let socket: Socket | null = null;
let listenersAttached = false;

function emitToHandlers<K extends keyof SocketEvents>(event: K, payload: SocketEvents[K]) {
  handlers[event]?.forEach((handler) => handler(payload));
}

export function onSocketEvent<K extends keyof SocketEvents>(
  event: K,
  handler: (payload: SocketEvents[K]) => void,
): () => void {
  if (!handlers[event]) handlers[event] = new Set();
  handlers[event]!.add(handler as Handler);
  return () => handlers[event]!.delete(handler as Handler);
}

function attachListeners() {
  if (!socket || listenersAttached) return;
  listenersAttached = true;

  socket.on('connected', (payload: SocketEvents['connected']) => emitToHandlers('connected', payload));
  socket.on('lead:moved', (payload: LeadMovedEvent) => emitToHandlers('lead:moved', payload));
  socket.on('proctor:focus-loss', (payload: ProctorFocusLossEvent) =>
    emitToHandlers('proctor:focus-loss', payload),
  );
  socket.on('notification', (payload: { count: number }) => emitToHandlers('notification', payload));
  socket.on('error', (payload: { message: string }) => emitToHandlers('error', payload));
  socket.on('connect_error', (err) => {
    // Handshake with an expired access token: the apiFetch refresh flow will
    // update the token; the next reconnect attempt picks it up automatically.
    if (String(err.message).includes('Authentication token')) {
      socket?.disconnect();
    }
  });
}

/** Connect (or reconnect with a fresh token) to the gateway. */
export function connectSocket(): Socket {
  if (socket?.connected) return socket;
  if (socket) socket.disconnect();

  socket = io(`${SOCKET_ORIGIN}/realtime`, {
    transports: ['websocket', 'polling'],
    auth: (cb) => cb({ token: getAccessToken() }),
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
  });
  attachListeners();
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
  listenersAttached = false;
}

export function getSocket(): Socket | null {
  return socket;
}
