import { Router } from 'express';
import env from '../env';

const router = Router();

router.get('/bagtag', async (_, res) => {
  if (!env.BAGTAG_ENDPOINT) {
    res.status(500).json({ message: 'BAGTAG_ENDPOINT not configured' });
    return;
  }

  try {
    const response = await fetch(env.BAGTAG_ENDPOINT);
    const body = await response.json();
    res.json(body);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'An error occured' });
  }
});

export default router;
