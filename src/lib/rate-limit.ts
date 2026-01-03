/**
 * Rate Limiting
 * Prevents accidental spend loops by limiting runs per minute
 */

import prisma from './db';

const MAX_RUNS_PER_MINUTE = 10;

/**
 * Check if user is rate limited and increment counter
 * @returns true if allowed, false if rate limited
 */
export async function checkRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  const now = new Date();
  // Create a window key for the current minute
  const windowKey = now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
  
  try {
    // Upsert the rate limit record
    const rateLimit = await prisma.rateLimit.upsert({
      where: {
        userId_windowKey: {
          userId,
          windowKey,
        },
      },
      update: {
        count: { increment: 1 },
      },
      create: {
        userId,
        windowKey,
        count: 1,
      },
    });
    
    const allowed = rateLimit.count <= MAX_RUNS_PER_MINUTE;
    const remaining = Math.max(0, MAX_RUNS_PER_MINUTE - rateLimit.count);
    
    return { allowed, remaining };
  } catch {
    // On error, allow the request but log
    console.error('Rate limit check failed, allowing request');
    return { allowed: true, remaining: MAX_RUNS_PER_MINUTE };
  }
}

/**
 * Clean up old rate limit records (call periodically)
 */
export async function cleanupRateLimits(): Promise<void> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  
  await prisma.rateLimit.deleteMany({
    where: {
      createdAt: {
        lt: fiveMinutesAgo,
      },
    },
  });
}
