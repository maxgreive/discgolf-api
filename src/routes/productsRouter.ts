import { Router } from 'express';
import { handleCache } from '../scrapers/storesScraper';

const router = Router();

router.get('/feed', async (_, res) => {
  try {
    const data = await handleCache('product-feed', 'all');
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'An error occured' });
  }
});

router.get('/:type/:query', async (req, res) => {
  const { type, query } = req.params;
  try {
    const data = await handleCache(type, query);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'An error occured' });
  }
});

export default router;
