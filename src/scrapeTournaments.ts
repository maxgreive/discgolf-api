import axios from 'axios';
import { removeDuplicates } from './utils.ts';
import { getCache, setCache } from './cache.ts';
import type { Request, Response, NextFunction } from 'express';
import type { OfficialTournament, MetrixTournament, TournamentOutput } from './types.ts';

import dotenv from 'dotenv';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

export function getTournaments(type: string, callback: () => Promise<any>) {
  return async (req: Request, res: Response, next: NextFunction) => {
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

async function handleCache(type: string, callback: () => Promise<any>) {
  const cacheData = await getCache(type);
  if (cacheData) return cacheData;
  const result = await callback();
  await setCache(type, result);
  return result;
}

async function getMetrixTournaments() {
  const url = process.env.METRIX_URL;
  if (!url) throw new Error('METRIX_URL not configured');
  const { data } = await axios.get<MetrixTournament[]>(url);
  const metrixTournaments = data;
  return { metrixTournaments };
}

export async function scrapeMetrix(): Promise<string> {
  const { metrixTournaments } = await getMetrixTournaments();

  return JSON.stringify(
    removeDuplicates(
      metrixTournaments.map((tournament: MetrixTournament): TournamentOutput => ({
        title: tournament[1].split(' &rarr;')[0],
        round: tournament[1].split(' &rarr;')[tournament[1].split(' &rarr;').length - 1],
        event_id: parseInt(tournament[0]),
        link: `https://discgolfmetrix.com/${tournament[0]}`,
        location: tournament[7].split(' &rarr;')[0],
        coords: {
          lat: tournament[2],
          lng: tournament[3]
        },
        dates: {
          startTournament: tournament[4].toString(),
        }
      }))
    )
  );
}

async function getOfficialTournaments() {
  if (!process.env.OFFICIAL_URL || !process.env.TOURNAMENTS_API_TOKEN || !process.env.TOURNAMENTS_API_SECRET) {
    throw new Error('Official tournament environment variables not configured');
  }
  const url = `${process.env.OFFICIAL_URL}?p=api&key=tournaments-actual&token=${process.env.TOURNAMENTS_API_TOKEN}&secret=${process.env.TOURNAMENTS_API_SECRET}`;
  const { data } = await axios.get<OfficialTournament[]>(url);
  const officialTournaments = data;
  return { officialTournaments };
}

export async function fetchOfficial(): Promise<string> {
  const { officialTournaments } = await getOfficialTournaments();

  const tournamentsArray = officialTournaments
    .filter(tournament => tournament.location_latitude && tournament.location_longitude)
    .map((tournament: OfficialTournament): TournamentOutput => ({
      title: tournament.event_name || 'Kein Name vergeben',
      event_id: tournament.event_id,
      link: `${process.env.OFFICIAL_URL}?p=events&sp=view&id=${tournament.event_id}`,
      location: tournament.location,
      coords: {
        lat: parseFloat(tournament.location_latitude) ?? null,
        lng: parseFloat(tournament.location_longitude) ?? null,
      },
      badge: tournament.status === 2 ? 'vorläufig' : undefined,
      dates: {
        startTournament: tournament.timestamp_start ? new Date(tournament.timestamp_start * 1000) : '',
        endTournament: tournament.timestamp_end ? new Date(tournament.timestamp_end * 1000) : '',
        startRegistration: tournament.timestamp_registration_phase ? new Date(tournament.timestamp_registration_phase * 1000) : '',
      },
      spots: {
        overall: tournament.spots,
        used: tournament.num_attendees,
      },
    })
    );
  return JSON.stringify(tournamentsArray);
}
