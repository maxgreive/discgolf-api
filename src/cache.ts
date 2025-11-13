import memjs from 'memjs';
import dotenv from 'dotenv';
dotenv.config();

// Create client safely — if MEMCACHIER_SERVERS is invalid,
// memjs will still create a client but will error on calls.
// That's fine because we'll swallow those errors.
const mc = memjs.Client.create(process.env.MEMCACHIER_SERVERS, {
  failover: true,
  timeout: 1,
  keepAlive: true,
});

export function getCache(key: string): Promise<unknown | null> {
  return new Promise((resolve) => {
    mc.get(key, (err, val) => {
      if (err) {
        return resolve(null);
      }
      if (!val) {
        return resolve(null);
      }
      try {
        return resolve(JSON.parse(val.toString()));
      } catch {
        return resolve(null);
      }
    });
  });
}

export function setCache(
  key: string,
  value: unknown,
  expiry: number = Number(process.env.CACHE_EXPIRY) || 3600
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
