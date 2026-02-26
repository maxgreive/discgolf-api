import Redis from 'ioredis';
import env from './env';

// // Create Redis client from HEROKU REDIS_URL
// If REDIS_URL is not set, defaults to localhost

const isProduction = env.NODE_ENV === 'production';
if (isProduction && !env.REDIS_URL) {
  throw new Error('REDIS_URL not configured for production');
}

const redis =
  isProduction || env.REDIS_URL
    ? new Redis(env.REDIS_URL as string, isProduction ? { tls: { rejectUnauthorized: false } } : {})
    : null;

const DEFAULT_EXPIRY = Number(env.CACHE_EXPIRY) || 3600;

export async function getCache<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    const val = await redis.get(key);
    if (!val) return null;
    return JSON.parse(val) as T;
  } catch {
    return null;
  }
}

export async function setCache<T>(
  key: string,
  value: T,
  expiry: number = DEFAULT_EXPIRY,
): Promise<void> {
  if (!redis) return;
  try {
    // 'EX' sets expiry in seconds
    await redis.set(key, JSON.stringify(value), 'EX', expiry);
  } catch {
    // Swallow errors like Memcached version
  }
}

let redisAvailable = false;
if (redis) {
  redis.on('connect', () => {
    redisAvailable = true;
    console.log('✅ Redis connected');
  });

  redis.on('error', (err) => {
    redisAvailable = false;
    console.warn('⚠️ Redis unavailable:', err.message);
  });

  redis.on('end', () => {
    redisAvailable = false;
    console.warn('⚠️ Redis connection closed');
  });
}

export function redisStatus() {
  return redisAvailable;
}
