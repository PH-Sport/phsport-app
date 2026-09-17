/**
 * El enlace de invitación: un token corto y aleatorio que caduca a las 24 h
 * y sirve una vez. Lo usan igual las invitaciones de personal y las de
 * jugador; lo que las distingue es qué lleva la fila (rol o ficha).
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function generateInviteToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let token = '';
  for (let i = 0; i < 16; i++) token += ALPHABET.charAt(bytes[i] % ALPHABET.length);
  return token;
}

export const INVITE_HOURS = 24;

export function inviteExpiry(now = new Date()): Date {
  const d = new Date(now);
  d.setHours(d.getHours() + INVITE_HOURS);
  return d;
}

export function inviteUrl(token: string): string {
  if (typeof window === 'undefined') return `/invite/${token}`;
  return `${window.location.origin}/invite/${token}`;
}
