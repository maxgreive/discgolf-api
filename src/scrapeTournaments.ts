import axios from 'axios';
import dotenv from 'dotenv';
import type { NextFunction, Request, Response } from 'express';
import { getCache, setCache } from './cache';
import env from './env';
import type { MetrixTournament, OfficialTournament, TournamentOutput } from './types.js';
import { removeDuplicates } from './utils';

dotenv.config();

const isProduction = env.NODE_ENV === 'production';

export function getTournaments<T>(type: string, callback: () => Promise<T>) {
  return async (_: Request, res: Response, next: NextFunction) => {
    try {
      const result = isProduction ? await handleCache(type, callback) : await callback();
      res.send(result);
    } catch (err) {
      next(err);
    }
  };
}

async function handleCache<T>(type: string, callback: () => Promise<T>): Promise<T> {
  const cacheData = await getCache<T>(type);
  if (cacheData) return cacheData;

  const result = await callback();
  await setCache(type, result);
  return result;
}

async function getMetrixTournaments() {
  const url = env.METRIX_URL;
  if (!url) throw new Error('METRIX_URL not configured');
  const { data } = await axios.get<MetrixTournament[]>(url);
  const metrixTournaments = data;
  return { metrixTournaments };
}

export async function scrapeMetrix(): Promise<string> {
  const { metrixTournaments } = await getMetrixTournaments();

  return JSON.stringify(
    removeDuplicates(
      metrixTournaments.map(
        (tournament: MetrixTournament): TournamentOutput => ({
          title: tournament[1].split(' &rarr;')[0],
          round: tournament[1].split(' &rarr;')[tournament[1].split(' &rarr;').length - 1],
          event_id: Number(tournament[0]),
          link: `https://discgolfmetrix.com/${tournament[0]}`,
          location: tournament[7].split(' &rarr;')[0],
          coords: {
            lat: tournament[2],
            lng: tournament[3],
          },
          dates: {
            startTournament: tournament[4].toString(),
          },
        }),
      ),
    ),
  );
}

async function getOfficialTournaments() {
  if (!env.OFFICIAL_URL || !env.TOURNAMENTS_API_TOKEN || !env.TOURNAMENTS_API_SECRET) {
    throw new Error('Official tournament environment variables not configured');
  }
  const url = `${env.OFFICIAL_URL}?p=api&key=tournaments-actual&token=${env.TOURNAMENTS_API_TOKEN}&secret=${env.TOURNAMENTS_API_SECRET}`;
  const { data } = await axios.get<OfficialTournament[]>(url);
  const officialTournaments = data;
  return { officialTournaments };
}

export async function fetchOfficial(): Promise<string> {
  const { officialTournaments } = await getOfficialTournaments();

  const tournamentsArray = officialTournaments
    .filter((tournament) => tournament.location_latitude && tournament.location_longitude)
    .map(
      (tournament: OfficialTournament): TournamentOutput => ({
        title: tournament.event_name || 'Kein Name vergeben',
        event_id: tournament.event_id,
        link: `${env.OFFICIAL_URL}?p=events&sp=view&id=${tournament.event_id}`,
        location: tournament.location,
        coords: {
          lat: Number.parseFloat(tournament.location_latitude) ?? null,
          lng: Number.parseFloat(tournament.location_longitude) ?? null,
        },
        badge: tournament.status === 2 ? 'vorläufig' : undefined,
        dates: {
          startTournament: tournament.timestamp_start
            ? new Date(tournament.timestamp_start * 1000)
            : '',
          endTournament: tournament.timestamp_end ? new Date(tournament.timestamp_end * 1000) : '',
          startRegistration: tournament.timestamp_registration_phase
            ? new Date(tournament.timestamp_registration_phase * 1000)
            : '',
        },
        spots: {
          overall: tournament.spots,
          used: tournament.num_attendees,
        },
      }),
    );
  return JSON.stringify(tournamentsArray);
}
