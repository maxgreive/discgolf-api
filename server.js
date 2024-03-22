import express from 'express';
import dotenv from 'dotenv';
import cors from "cors";
import { getTournaments, scrapeOfficial, scrapeMetrix } from './scrapeTournaments.js';
import { scrapeStores } from "./scrapeStores.js";

dotenv.config();

const app = express();

app.use(cors());

const allowedOrigin = process.env.ALLOWED_ORIGIN;

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin
    // (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigin.indexOf(origin) === -1) {
      var msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
}));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({ message: err.message });
});

app.get('/tournaments', (req, res, next) => getTournaments('official', scrapeOfficial)(req, res, next));

app.get('/tournaments/metrix', (req, res, next) => getTournaments('metrix', scrapeMetrix)(req, res, next));

app.get("/products/discgolfstore", (req, res, next) => {
  if (req.query.q) {
    scrapeStores('discgolfstore', req.query.q).then((products) => {
      res.send(products);
    });
  } else {
    res.send("No query provided");
  }
});

app.get("/products/thrownatur", (req, res, next) => {
  if (req.query.q) {
    scrapeStores('thrownatur', req.query.q).then((products) => {
      res.send(products);
    });
  } else {
    res.send("No query provided");
  }
});

app.get("/products/crosslap", (req, res, next) => {
  if (req.query.q) {
    scrapeStores('crosslap', req.query.q).then((products) => {
      res.send(products);
    });
  } else {
    res.send("No query provided");
  }
});

app.get("/products/frisbeeshop", (req, res, next) => {
  if (req.query.q) {
    scrapeStores('frisbeeshop', req.query.q).then((products) => {
      res.send(products);
    });
  } else {
    res.send("No query provided");
  }
});

app.listen(process.env.PORT || 8080, () => console.log(`Server has started on port ${process.env.PORT || 8080}`));
