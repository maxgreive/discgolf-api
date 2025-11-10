import memjs from 'memjs';
import dotenv from 'dotenv';
dotenv.config();

const mc = memjs.Client.create(process.env.MEMCACHIER_SERVERS, {
  failover: true,
  timeout: 1,
  keepAlive: true
});

export function getCache(key: string): Promise<unknown | null> {
  return new Promise((resolve, reject) => {
    mc.get(key, (err, val) => {
      if (err) {
        return reject(err);
      }
      if (!val) {
        return resolve(null);
      }
      try {
        const str = val.toString();
        resolve(JSON.parse(str));
      } catch (e) {
        reject(e);
      }
    });
  });
}

export function setCache(
  key: string,
  value: unknown,
  expiry: number = Number(process.env.CACHE_EXPIRY) || 3600
): Promise<void> {
  return new Promise((resolve, reject) => {
    mc.set(key, JSON.stringify(value), { expires: expiry }, (err: Error | null) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

