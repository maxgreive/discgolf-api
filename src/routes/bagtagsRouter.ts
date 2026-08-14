import { Router } from 'express';
import { z } from 'zod';
import env from '../env';

const router = Router();
const bagTagSchema = z.array(
  z.object({
    Rank: z.string(),
    Name: z.string(),
    Motiv: z.string(),
  }),
);

router.get('/', async (_, res) => {
  if (!env.BAGTAG_ENDPOINT) {
    res.status(500).json({ message: 'BAGTAG_ENDPOINT not configured' });
    return;
  }

  try {
    const response = await fetch(env.BAGTAG_ENDPOINT);
    const body = await response.json();
    const parsed = bagTagSchema.safeParse(body);
    if (!parsed.success) {
      console.error('Bag-tag endpoint returned an invalid payload', parsed.error);
      res.status(500).json({ message: 'Bag-tag endpoint returned an invalid payload' });
      return;
    }
    res.json(parsed.data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'An error occured' });
  }
});

export default router;
