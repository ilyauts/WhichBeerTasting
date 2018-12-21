const express = require('express'),
  server = express(),
  bodyParser = require('body-parser');

var {
  google
} = require('googleapis');
const OAuth2Client = google.auth.OAuth2;
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

const path = require('path');

server.use(bodyParser.json()); // to support JSON-encoded bodies
server.use(bodyParser.urlencoded({ // to support URL-encoded bodies
  extended: true
}));

// Serve all from public
server.use(express.static('public'));
server.use(express.static(__dirname + '../public'));
server.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Methods", "*");
  next();
});

var cachedRows = [],
  lastCache = null,
  deltaTime = 1000 * 60 * 10;

/**
 * Prints the names and majors of students in a sample spreadsheet:
 */
function listBeers() {
  const sheets = google.sheets({
    version: 'v4',
    auth: process.env.GOOGLE_TOKEN || '<YOUR GOOGLE TOKEN HERE>'
  });

  if (!lastCache || lastCache + deltaTime <= timeNow()) {
    return new Promise((good, bad) => {
      sheets.spreadsheets.values.get({
        spreadsheetId: '1oj1MBIlzoE5AhITjd0IDKyJQVr1uwN7IC0-9va5bNTs',
        range: 'Beer List - By Tasting!A1:IL',
      }, (err, dataContainer) => {

        if (err) return console.log('The API returned an error: ' + err);

        const rows = dataContainer.data.values;
        cachedRows = rows;
        lastCache = timeNow();

        return good(rows);
      });
    }).catch(err => {
      console.log('(listBeers) Error', err);
    });
  } else {
    return new Promise(good => good(cachedRows));
  }
}


server.get('/ping', (req, res) => {
  res.send({
    'msg': `I'm Alive`
  })
});

server.get('/filter', (req, res) => {
  listBeers().then(rows => {
    let headers = rows[0];

    // Get a list of beer names
    let beerNames = [],
      companies = [];

    // Now go through all the data
    for (let rowIndex = 1; rowIndex < rows.length; ++rowIndex) {

      // No script tags here...
      if (validText(rows[rowIndex][0])) {
        companies.push(rows[rowIndex][0]);
      }
      if (validText(rows[rowIndex][2])) {
        beerNames.push(rows[rowIndex][2]);
      }
    }

    // Let's create a set
    let companiesSet = new Set(companies);
    let companiesShortArray = Array.from(companiesSet);

    let name = req.query.name;
    if (!name) {
      res.send({
        beers: beerNames,
        companies: companiesShortArray,
        total: rows
      });
      return;
    }

    let chillFilteredBeers = [],
      chillFilteredCompanies = [];
    for (let beer of beerNames) {
      if (beer.toLowerCase().includes(name.toLowerCase())) {
        chillFilteredBeers.push(beer);
      }
    }
    for (let company of companiesShortArray) {
      if (company.toLowerCase().includes(name.toLowerCase())) {
        chillFilteredCompanies.push(company);
      }
    }
    res.send({
      beers: chillFilteredBeers,
      companies: chillFilteredCompanies
    });
  }).catch(err => {
    console.log('(/filter) Error', err);
  });
});

function validText(text) {
  return (text && !text.includes('<'));
}

function timeNow() {
  return (new Date).getTime();
}

server.listen(process.env.PORT || 5555, () => {
  console.log('Which Beer now listening on port', process.env.PORT || 5555);
});