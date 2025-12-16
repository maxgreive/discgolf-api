import cors from 'cors';
import dotenv from 'dotenv';
import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import env from './env';
import bagtagRouter from './routes/bagtagsRouter';
import indexRouter from './routes/indexRouter';
import productsRouter from './routes/productsRouter';
import ratingsRouter from './routes/ratingsRouter';
import scoresRouter from './routes/scoresRouter';
import stripeRouter from './routes/stripeRouter';
import tournamentsRouter from './routes/tournamentsRouter';

dotenv.config();

const app = express();

if (env.NODE_ENV === 'production') {
  const allowedOrigins = (env.ALLOWED_ORIGIN ?? '').split(',').map((o) => o.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        // allow requests with no origin
        // (curl, mobile apps, server-to-server)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        console.warn(`Blocked CORS request from origin: ${origin}`);
        return callback(new Error(`CORS policy: origin ${origin} not allowed`));
      },
    }),
  );
} else {
  app.use(cors({ origin: true }));
}

app.use((err: Error, _: Request, res: Response, __: NextFunction) => {
  console.error(err.stack);
  res.status(500).send({ message: err.message });
});

app.use('/', indexRouter);
app.use('/tournaments', tournamentsRouter);
app.use('/bagtag', bagtagRouter);
app.use('/ratings', ratingsRouter);
app.use('/scores', scoresRouter);
app.use('/products', productsRouter);
app.use('/stripe-webhook', stripeRouter);

export default app;
