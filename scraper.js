import axios from 'axios';
import cheerio from 'cheerio';
import { removeDuplicates } from './utils.js';
import { getCache, setCache } from './cache.js';

import dotenv from 'dotenv';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

export function getTournaments(type, scrapeFunction) {
  return async (req, res, next) => {
    try {
      let result;
      if (isProduction) {
        result = await handleCache(type, scrapeFunction);
      } else {
        result = await scrapeFunction();
      }
      res.send(result);
    } catch (err) {
      next(err);
    }
  };
}

async function handleCache(type, scrapeFunction) {
  const cacheData = await getCache(type);
  if (cacheData) return cacheData;
  const result = await scrapeFunction();
  await setCache(type, result);
  return result;
}

async function getOfficialTournaments() {
  const url = process.env.OFFICIAL_URL;
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);
  const tournaments = $('#list_tournaments tbody tr');
  return { $, tournaments };
}

export async function scrapeOfficial() {
  const tournamentsArray = [];
  const { $, tournaments } = await getOfficialTournaments();

  tournaments.each((i, el) => {
    try {
      const tournament = $(el);
      const titleLink = tournament.find('td:first-child a');
      const locationLink = tournament.find('td:nth-child(2) a');
      const [lat, lng] = locationLink.attr('href')?.split('/place/')[1].split(',') || [null, null];

      tournamentsArray.push({
        title: titleLink.text().trim(),
        link: titleLink.attr('href'),
        location: locationLink.text().trim(),
        coords: {
          lat: parseFloat(lat),
          lng: parseFloat(lng)
        },
        dates: {
          startTournament: new Date(parseInt(tournament.find('td:nth-child(3)').attr('data-sort')) * 1000),
          endTournament: new Date(parseInt(tournament.find('td:nth-child(4)').attr('data-sort')) * 1000),
          startRegistration: tournament.find('td:nth-child(5)').attr('data-sort') !== "0" ? new Date(parseInt(tournament.find('td:nth-child(5)').attr('data-sort')) * 1000) : null
        }
      });
    } catch (err) {
      console.error(`Error while parsing tournament ${i}: ${err.message}`);
    }
  });

  return JSON.stringify(tournamentsArray);
}

async function getMetrixTournaments() {
  const url = process.env.METRIX_URL;
  const { data } = await axios.get(url);
  const metrixTournaments = data;
  return { metrixTournaments };
}

export async function scrapeMetrix() {
  const { metrixTournaments } = await getMetrixTournaments();

  const tournamentsArray = metrixTournaments.map(tournament => {
    if (!tournament[1]) return false;
    return {
      title: tournament[1].split(' &rarr;')[0],
      round: tournament[1].split(' &rarr;')[tournament[1].split(' &rarr;').length - 1],
      id: tournament[0],
      link: `https://discgolfmetrix.com/${tournament[0]}`,
      location: tournament[7].split(' &rarr;')[0],
      coords: {
        lat: tournament[2],
        lng: tournament[3]
      },
      dates: {
        startTournament: tournament[4]
      }
    }
  }).filter(Boolean);

  return JSON.stringify(removeDuplicates(tournamentsArray));
}
