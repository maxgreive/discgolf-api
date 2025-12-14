import axios from 'axios';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import Stripe from 'stripe';
import env from './env';
import { getRatings } from './scrapeRating';
import { handleCache } from './scrapeStores';
import { fetchOfficial, getTournaments, scrapeMetrix } from './scrapeTournaments';
import { scrapeScores, scrapeUltiorganizer } from './scrapeUltimateScores';

dotenv.config();

const app = express();

app.use(bodyParser.text({ type: '*/*' }));

if (env.NODE_ENV === 'production') {
  const allowedOrigin = env.ALLOWED_ORIGIN;
  app.use(
    cors({
      origin: (origin, callback) => {
        // allow requests with no origin
        // (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        const msg = `The CORS policy for this site does not allow access from origin ${origin}.`;
        if (allowedOrigin?.indexOf(origin) === -1) {
          return callback(new Error(msg), false);
        }
        return callback(null, true);
      },
    }),
  );
} else {
  app.use(cors({ origin: '*' }));
}

app.use((err: Error, _: Request, res: Response, __: NextFunction) => {
  console.error(err.stack);
  res.status(500).send({ message: err.message });
});

app.get('/tournaments', async (req, res, next) =>
  getTournaments('official', fetchOfficial)(req, res, next),
);

app.get('/tournaments/metrix', async (req, res, next) =>
  getTournaments('metrix', scrapeMetrix)(req, res, next),
);

app.get('/bagtag', async (_, res) => {
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

app.get('/products/:type/:query', async (req, res) => {
  const { type, query } = req.params;
  try {
    const data = await handleCache(type, query);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'An error occured' });
  }
});

app.get('/product-feed', async (_, res) => {
  try {
    const data = await handleCache('product-feed', 'all');
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'An error occured' });
  }
});

app.get('/ratings', async (_, res) => {
  try {
    const data = await getRatings();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'An error occured' });
  }
});

// Ultiorganizer

app.get('/scores', async (_, res) => {
  try {
    const data = await scrapeUltiorganizer();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'An error occured' });
  }
});

app.get('/scores/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const data = await scrapeScores(id);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'An error occured' });
  }
});

// Endpoint for stripe webhook
// Transforms the data for a Discord notification

const endpointSecret = env.STRIPE_WEBHOOK_SECRET;
const stripe = new Stripe(env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

app.post('/stripe-webhook', express.raw({ type: 'application/json' }), (request, response) => {
  const sig = request.headers['stripe-signature'];
  if (!sig || !endpointSecret) return;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
  } catch (err) {
    console.error('err:', err);
    response.status(400).end();
    return;
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const intent = event.data.object as Stripe.PaymentIntent;
      triggerDiscordNotification(intent);
      break;
    }
    default:
      console.warn('Unhandled event type:', event.type);
  }

  response.sendStatus(200);
});

async function triggerDiscordNotification(intent: Stripe.PaymentIntent) {
  const url = env.DISCORD_WEBHOOK_URL;
  const channelId = env.DISCORD_CHANNEL_ID;
  if (!url || !channelId) return;

  const data = {
    content: `New payment over ${intent.amount / 100} ${intent.currency.toUpperCase()} received: Check Stripe for details: https://dashboard.stripe.com/payments/${intent.id}`,
    channel_id: channelId,
  };

  try {
    await axios.post(url, data);
  } catch (error) {
    console.error(error);
  }
}

app.listen(env.PORT || 8080, () =>
  // eslint-disable-next-line no-console
  console.log(`Server has started on http://localhost:${env.PORT || 8080}`),
);
