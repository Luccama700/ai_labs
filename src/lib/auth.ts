/**
 * Authentication utilities
 * Simple password-based auth for local use with JWT sessions
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { hash, compare } from 'bcryptjs';
import { cookies } from 'next/headers';

const SALT_ROUNDS = 12;
const SESSION_COOKIE = 'ai_lab_session';
const SESSION_DURATION = 60 * 60 * 24 * 7; // 7 days in seconds

interface SessionPayload extends JWTPayload {
  userId: string;
  email: string;
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET environment variable is not set. ' +
      'Generate with: openssl rand -hex 32'
    );
  }
  return new TextEncoder().encode(secret);
}

/**
 * Hash a password for storage
 */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return compare(password, hashedPassword);
}

/**
 * Create a session token for a user
 */
export async function createSessionToken(userId: string, email: string): Promise<string> {
  const secret = getJwtSecret();
  
  const token = await new SignJWT({ userId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(secret);
  
  return token;
}

/**
 * Verify and decode a session token
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Set the session cookie
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION,
    path: '/',
  });
}

/**
 * Get the current session from cookies
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  
  if (!token) {
    return null;
  }
  
  return verifySessionToken(token);
}

/**
 * Clear the session cookie
 */
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/**
 * Get current user ID from session, throw if not authenticated
 */
export async function requireAuth(): Promise<{ userId: string; email: string }> {
  const session = await getSession();
  
  if (!session || !session.userId) {
    throw new Error('Unauthorized');
  }
  
  return { userId: session.userId, email: session.email };
}
