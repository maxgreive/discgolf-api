import axios from 'axios';
import * as cheerio from 'cheerio';

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
        const seriesTitle = $('#seriesNav1722').text().trim();
        const games = await Promise.all(rows.map(async row => {
            const columns = $(row).find('td');
            if (!columns.length) return;
            const metaInfo = $(row).closest('table').prevUntil('h2').nextAll('h3').first();
            const regex = /\d+.\d+.\d{4}/;
            const dateString = metaInfo.text().trim().match(regex);
            return {
                teams: {
                    home: $(columns[2]).text().trim(),
                    away: $(columns[4]).text().trim(),
                },
                scores: {
                    home: $(columns[5]).text().trim(),
                    away: $(columns[7]).text().trim(),
                },
                startTime: $(columns[0]).text().trim(),
                pitch: $(columns[1]).text().trim(),
                date: dateString ? dateString[0] : null,
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
