const axios = require('axios');
const cheerio = require('cheerio');
const app = require('express')();
const port = process.env.PORT || 8080;

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://syndikat.golf');
  next();
});

async function getTournaments() {
  const url = 'https://turniere.discgolf.de/index.php?p=events';
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);
  const tournaments = $('#list_tournaments tbody tr');
  return { $, tournaments };
}

app.get('/', async (req, res) => {
  try {
    const tournamentsArray = [];
    const { $, tournaments } = await getTournaments();

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

app.listen(port, () => console.log(`Server has started on port ${port}`))
