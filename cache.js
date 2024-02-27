import memjs from 'memjs';
import dotenv from 'dotenv';
dotenv.config();

const mc = memjs.Client.create(process.env.MEMCACHIER_SERVERS, {
  failover: true,
  timeout: 1,
  keepAlive: true
});

export function getCache(key) {
  return new Promise((resolve, reject) => {
    mc.get(key, (err, val) => {
      if (err) {
        reject(err);
      } else {
        resolve(val);
      }
    });
  });
}

export function setCache(key, value) {
  return new Promise((resolve, reject) => {
    mc.set(key, value, { expires: 60 * 60 * 3 }, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}
