import axios from 'axios';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
import { getCache, setCache } from './cache';
import { getCell } from './utils';

dotenv.config();

const endpoint = process.env.RATING_URL ? new URL(process.env.RATING_URL) : null;

async function scrapeRatings() {
  if (!endpoint) {
    console.error('RATING_URL not configured');
    return { message: 'RATING_URL not configured' };
  }
  try {
    const html = await axios.get<string>(endpoint.toString()).then((response) => response.data);
    const $ = cheerio.load(html);

    const divisionCount = getDivisionCount($);

    const rows = $('#table tbody tr').toArray();
    const ratings = await Promise.all(
      rows.map(async (element) => {
        const columns = $(element).find('td');
        const club = getCell($(columns[8])).toString();
        const pathname = $(columns[3]).find('a').attr('href');
        const link = pathname ? new URL(pathname, endpoint).toString() : null;
        const ratingChangeSymbol = getCell($(columns[6])).toString().slice(-1).charCodeAt(0);
        const ratingChange =
          ratingChangeSymbol === 8593 ? 1 : ratingChangeSymbol === 8595 ? -1 : null;

        return {
          firstName: getCell($(columns[2])),
          lastName: getCell($(columns[3])),
          rating: getCell($(columns[6]), true),
          ratingChange: ratingChange,
          divisionCount: divisionCount[getCell($(columns[5]))] || 0,
          gtNumber: getCell($(columns[4]), true),
          division: getCell($(columns[5])),
          lastRound: new Date(getCell($(columns[9])).toString().split('.').reverse().join('-')),
          roundCount: getCell($(columns[10]), true),
          dmRounds: getCell($(columns[11]), true),
          rank: getCell($(columns[0]), true),
          divisionRank: getCell($(columns[1]), true),
          link: link,
          club: club
            .replace('Disc Golf', 'DG')
            .replace('Discgolf', 'DG')
            .replace('Disc-Golf', 'DG')
            .replace('DiscGolf', 'DG'),
        };
      }),
    );

    return ratings.filter(Boolean);
  } catch (error) {
    console.error(error);
    return { message: 'An error occured' };
  }
}

export async function getRatings() {
  if (process.env.NODE_ENV === 'production') {
    const cache = await getCache('ratings');
    if (cache) return cache;
    const ratings = await scrapeRatings();
    setCache('ratings', ratings, 3600);
    return ratings;
  }

  return await scrapeRatings();
}

function getDivisionCount($: cheerio.Root) {
  const divisions = $('#table tbody tr')
    .toArray()
    .map((element) => getCell($(element).find('td').eq(5)));

  const divisionCount = divisions.reduce<Record<string, number>>((acc, division) => {
    if (!acc[division]) acc[division] = 0;
    acc[division]++;
    return acc;
  }, {});

  return divisionCount;
}
