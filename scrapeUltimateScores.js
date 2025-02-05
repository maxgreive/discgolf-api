import axios from 'axios';
import * as cheerio from 'cheerio';
import { getCell } from './utils.js';

export async function scrapeScores(id) {
    const BASE_URL = 'https://scores.frisbeesportverband.de/';
    const endpoint = new URL(BASE_URL);
    endpoint.searchParams.set('view', 'games');
    endpoint.searchParams.set('series', id);

    let data;
    try {
        const html = await axios.get(endpoint).then(response => response.data);
        const $ = cheerio.load(html);
        const rows = $('.admintable.wide tr').toArray();
        const seriesTitle = $(`#seriesNav${id}`).text().trim();
        const games = await Promise.all(rows.map(async row => {
            const columns = $(row).find('td');
            if (!columns.length) return;
            const metaInfo = $(row).closest('table').prevUntil('h2').nextAll('h3').first();
            const regex = /\d+.\d+.\d{4}/;
            const dateString = metaInfo.text().trim().match(regex);
            const time = getCell($(columns[0]));
            return {
                teams: {
                    home: getCell($(columns[2])),
                    away: getCell($(columns[4])),
                },
                scores: {
                    home: getCell($(columns[5]), true) ?? 0,
                    away: getCell($(columns[7]), true) ?? 0,
                },
                pitch: getCell($(columns[1])),
                date: dateString ? formatDate(dateString[0], time) : null,
                location: metaInfo.find('a').text().trim(),
                roundTitle: $(row).closest('tbody').find('th').text().trim().replace(seriesTitle, '').trim()
            }
        }));
        data = games.filter(Boolean);
    } catch (error) {
        console.error(error);
    }

    return data;
}

function formatDate(string, time) {
    let newString = string.split('.').reverse().join('-');
    if (time) {
        newString += ' ' + time + ':00 GMT';
    }
    return new Date(newString)
}