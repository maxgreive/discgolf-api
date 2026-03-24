import { Router } from 'express';
import { fetchOfficial, getTournaments, scrapeMetrix } from '../scrapers/tournamentsScraper';
import { handleTournamentRoute, tournamentRouteJsonMiddleware } from './routePlanner.js';

const router = Router();

router.post('/route', tournamentRouteJsonMiddleware, handleTournamentRoute);

router.get('/', async (req, res, next) =>
  getTournaments('official', fetchOfficial)(req, res, next),
);

router.get('/metrix', async (req, res, next) =>
  getTournaments('metrix', scrapeMetrix)(req, res, next),
);

export default router;
