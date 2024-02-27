import express from 'express';
import dotenv from 'dotenv';
import { getTournaments, scrapeOfficial, scrapeMetrix } from './scraper.js';

dotenv.config();

const app = express();

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN);
  next();
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({ message: err.message });
});

app.get('/', (req, res, next) => getTournaments('official', scrapeOfficial)(req, res, next));
app.get('/metrix', (req, res, next) => getTournaments('metrix', scrapeMetrix)(req, res, next));

app.listen(process.env.PORT || 8080, () => console.log(`Server has started on port ${process.env.PORT || 8080}`));
