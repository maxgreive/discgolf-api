const axios = require('axios');
const cheerio = require('cheerio');
const app = require('express')();
const port = process.env.PORT || 8080;

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://cdpn.io');
  next();
});

app.get('/', async (req, res) => {
  try {
    const url = 'https://turniere.discgolf.de/index.php?p=events';
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    tournamentsArray = [];

    const tournaments = $('#list_tournaments tbody tr');
    tournaments.each((i, el) => {
      const tournament = $(el);

      tournamentsArray.push({
        title: tournament.find('td:first-child a').text().trim(),
        link: tournament.find('td:first-child a').attr('href'),
        location: tournament.find('td:nth-child(2) a').text().trim(),
        coords: {
          lat: parseFloat(tournament.find('td:nth-child(2) a').attr('href')?.split('/place/')[1].split(',')[0]) || null,
          lng: parseFloat(tournament.find('td:nth-child(2) a').attr('href')?.split('/place/')[1].split(',')[1]) || null
        },
        dates: {
          startTournament: new Date(parseInt(tournament.find('td:nth-child(3)').attr('data-sort')) * 1000),
          endTournament: new Date(parseInt(tournament.find('td:nth-child(4)').attr('data-sort')) * 1000),
          startRegistration: tournament.find('td:nth-child(5)').attr('data-sort') !== "0" ? new Date(parseInt(tournament.find('td:nth-child(5)').attr('data-sort')) * 1000) : null
        }
      });
    });
    res.send(JSON.stringify(tournamentsArray));
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
})

app.listen(port, () => console.log(`Server has started on port ${port}`))