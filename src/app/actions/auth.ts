'use server';

/**
 * Authentication Server Actions
 */

import prisma from '@/lib/db';
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  setSessionCookie,
  clearSession,
  getSession,
} from '@/lib/auth';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export interface AuthState {
  error?: string;
  success?: boolean;
}

export async function login(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  try {
    const data = loginSchema.parse({
      email: formData.get('email'),
      password: formData.get('password'),
    });

    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      return { error: 'Invalid email or password' };
    }

    const isValid = await verifyPassword(data.password, user.passwordHash);
    if (!isValid) {
      return { error: 'Invalid email or password' };
    }

    const token = await createSessionToken(user.id, user.email);
    await setSessionCookie(token);

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: error.errors[0].message };
    }
    return { error: 'An error occurred during login' };
  }
}

export async function register(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  try {
    const data = registerSchema.parse({
      email: formData.get('email'),
      password: formData.get('password'),
    });

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      return { error: 'An account with this email already exists' };
    }

    const passwordHash = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
      },
    });

    const token = await createSessionToken(user.id, user.email);
    await setSessionCookie(token);

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: error.errors[0].message };
    }
    return { error: 'An error occurred during registration' };
  }
}

export async function logout(): Promise<void> {
  await clearSession();
  redirect('/login');
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) {
    return null;
  }
  
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, createdAt: true },
  });
  
  return user;
}
