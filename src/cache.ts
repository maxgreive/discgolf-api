import dotenv from 'dotenv';
import Redis from 'ioredis';
import env from './env';

dotenv.config();

// // Create Redis client from HEROKU REDIS_URL
// If REDIS_URL is not set, defaults to localhost

const redis = new Redis(env.REDIS_URL || 'redis://localhost:6379');

const DEFAULT_EXPIRY = Number(env.CACHE_EXPIRY) || 3600;

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const val = await redis.get(key);
    console.log('val', val);
    if (!val) return null;
    console.log('val', val);
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
  try {
    // 'EX' sets expiry in seconds
    await redis.set(key, JSON.stringify(value), 'EX', expiry);
  } catch {
    // Swallow errors like Memcached version
  }
}
