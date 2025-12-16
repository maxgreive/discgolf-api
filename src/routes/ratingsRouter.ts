import { Router } from 'express';
import { getRatings } from '../scrapers/ratingsScraper';

const router = Router();

router.get('/', async (_, res) => {
  try {
    const data = await getRatings();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'An error occured' });
  }
});

export default router;
