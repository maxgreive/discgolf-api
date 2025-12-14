import dotenv from 'dotenv';
import memjs from 'memjs';
import env from './env';

dotenv.config();

// Create client safely — if MEMCACHIER_SERVERS is invalid,
// memjs will still create a client but will error on calls.
// That's fine because we'll swallow those errors.
const mc = memjs.Client.create();

export function getCache<T>(key: string): Promise<T | null> {
  return new Promise((resolve) => {
    mc.get(key, (err, val) => {
      if (err || !val) {
        return resolve(null);
      }

      try {
        resolve(JSON.parse(val.toString()) as T);
      } catch {
        resolve(null);
      }
    });
  });
}

export function setCache<T>(
  key: string,
  value: T,
  expiry: number = Number(env.CACHE_EXPIRY) || 3600,
): Promise<void> {
  return new Promise((resolve) => {
    try {
      mc.set(key, JSON.stringify(value), { expires: expiry }, () => {
        resolve();
      });
    } catch {
      resolve();
    }
  });
}
