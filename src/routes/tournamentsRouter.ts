import { Router } from 'express';
import { fetchOfficial, getTournaments, scrapeMetrix } from '../scrapers/tournamentsScraper';

const router = Router();

router.get('/', async (req, res, next) =>
  getTournaments('official', fetchOfficial)(req, res, next),
);

router.get('/metrix', async (req, res, next) =>
  getTournaments('metrix', scrapeMetrix)(req, res, next),
);

export default router;
