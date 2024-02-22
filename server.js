const axios = require('axios');
const cheerio = require('cheerio');
const app = require('express')();
const port = process.env.PORT || 8080;

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://syndikat.golf');
  next();
});

async function getOfficialTournaments() {
  const url = 'https://turniere.discgolf.de/index.php?p=events';
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);
  const tournaments = $('#list_tournaments tbody tr');
  return { $, tournaments };
}

async function getMetrixTournaments() {
  const url = 'https://discgolfmetrix.com/competitions_map_server.php?view=3&date1=2024-01-01&date2=2024-12-31&country_code=DE&page=all';
  const { data } = await axios.get(url);
  const metrixTournaments = data;
  return { metrixTournaments };
}

app.get('/', async (req, res) => {
  try {
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
    res.send(JSON.stringify(tournamentsArray));
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

app.get('/metrix', async (req, res) => {
  try {
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

    removeDuplicates(tournamentsArray)
    res.send(JSON.stringify(removeDuplicates(tournamentsArray)));
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

app.listen(port, () => console.log(`Server has started on port ${port}`))

function removeDuplicates(tournaments) {
  const seen = {};
  const relatedTournaments = {};

  const result = tournaments.filter(tournament => {
    const handle = tournament.title + ' - ' + tournament.dates.startTournament;
    if (seen[handle]) {
      const data = {id: tournament.id, round: tournament.round.trim()};
      relatedTournaments[seen[handle]]?.length ? relatedTournaments[seen[handle]].push(data) : relatedTournaments[seen[handle]] = [data];
      return false;
    } else {
      seen[handle] = tournament.id;
      return tournament;
    }
  }).map(tournament => {
    if (relatedTournaments[tournament.id]) {
      tournament.relatedTournaments = relatedTournaments[tournament.id];
    }
    return tournament;
  });

  return result;
}