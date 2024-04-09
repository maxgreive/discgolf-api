import axios from 'axios';
import { removeDuplicates } from './utils.js';
import { getCache, setCache } from './cache.js';

import dotenv from 'dotenv';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

export function getTournaments(type, callback) {
  return async (req, res, next) => {
    try {
      let result;
      if (isProduction) {
        result = await handleCache(type, callback);
      } else {
        result = await callback();
      }
      res.send(result);
    } catch (err) {
      next(err);
    }
  };
}

async function handleCache(type, callback) {
  const cacheData = await getCache(type);
  if (cacheData) return cacheData;
  const result = await callback();
  await setCache(type, result);
  return result;
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

export async function fetchOfficial() {
  try {
    const response = await fetch(`${process.env.OFFICIAL_URL}?p=api&key=tournaments-actual&token=${process.env.TOURNAMENTS_API_TOKEN}&secret=${process.env.TOURNAMENTS_API_SECRET}`);
    const body = await response.json();
    const tournaments = body.filter(tournament => tournament.location_latitude && tournament.location_longitude).map(tournament => {
      return {
        title: tournament.event_name,
        link: `${process.env.OFFICIAL_URL}&sp=view&id=${tournament.event_id}`,
        location: tournament.location,
        coords: {
          lat: tournament.location_latitude,
          lng: tournament.location_longitude
        },
        badge: tournament.status === 2 ? 'vorläufig' : null,
        dates: {
          startTournament: new Date(tournament.timestamp_start * 1000),
          endTournament: new Date(tournament.timestamp_end * 1000),
          startRegistration: new Date(tournament.timestamp_registration_phase * 1000),
        }
      }
    })
    return JSON.stringify(tournaments);
  } catch (error) {
    console.error(error);
  }
}
