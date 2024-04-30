import axios from "axios";
import * as cheerio from "cheerio";
import { getCache, setCache } from "./cache.js";

import dotenv from 'dotenv';
dotenv.config();

const endpoint = process.env.RATING_URL;

async function scrapeRatings() {
  try {
    const html = await axios.get(endpoint).then(response => response.data);
    const $ = cheerio.load(html);

    const divisionCount = getDivisionCount($);

    const rows = $('#table tbody tr').toArray();
    const ratings = await Promise.all(rows.map(async element => {
      const columns = $(element).find('td');
      const club = getCell($(columns[8]));
      const link = process.env.RATING_URL + '/' + $(columns[3]).find('a').attr('href');
      const ratingChangeSymbol = getCell($(columns[6])).slice(-1).charCodeAt();
      const ratingChange = ratingChangeSymbol === 8593 ? 1 : ratingChangeSymbol === 8595 ? -1 : null;

      return {
        firstName: getCell($(columns[2])),
        lastName: getCell($(columns[3])),
        rating: getCell($(columns[6]), true),
        ratingChange: ratingChange,
        divisionCount: divisionCount[getCell($(columns[5]))] || 0,
        gtNumber: getCell($(columns[4]), true),
        division: getCell($(columns[5])),
        lastRound: new Date(getCell($(columns[9])).split('.').reverse().join('-')),
        roundCount: getCell($(columns[10]), true),
        dmRounds: getCell($(columns[11]), true),
        rank: getCell($(columns[0]), true),
        divisionRank: getCell($(columns[1]), true),
        link: link,
        club: club.replace('Disc Golf', 'DG').replace('Discgolf', 'DG').replace('Disc-Golf', 'DG').replace('DiscGolf', 'DG'),
      }
    }));

    return ratings.filter(Boolean);
  } catch (error) {
    console.error(error);
    return { message: 'An error occured' };
  }
}

function getCell(element, number = false) {
  if (number) return parseInt(element.text().trim().replace(/\D/g, ''));
  return element.text().trim();
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


function getDivisionCount($) {
  const divisions = $('#table tbody tr').toArray().map(element => getCell($(element).find('td').eq(5)));

  const divisionCount = divisions.reduce((acc, division) => {
    if (!acc[division]) acc[division] = 0;
    acc[division]++;
    return acc;
  }, {});

  return divisionCount;
}
