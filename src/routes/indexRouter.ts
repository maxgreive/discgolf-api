import { Router } from 'express';
import { redisStatus } from '../cache';

const router = Router();

router.get('/', (_, res) => res.json({ status: 'ok' }));
router.get('/health', (_, res) => {
  res.json({
    status: 'ok',
    redis: redisStatus() ? 'up' : 'down',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

export default router;
