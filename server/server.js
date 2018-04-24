require('appmetrics-dash').attach();
require('appmetrics-prometheus').attach();

const express = require('express'),
  server = express(),
  bodyParser = require('body-parser');
const fs = require('fs');
const readline = require('readline');
var {
  google
} = require('googleapis');
const OAuth2Client = google.auth.OAuth2;
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
const TOKEN_PATH = 'credentials.json';

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
})


/**
 * Create an OAuth2 client with the given credentials
 * @param {Object} credentials The authorization client credentials.
 */
function authorize(credentials) {
  const {
    client_secret,
    client_id,
    redirect_uris
  } = credentials.installed;
  const oAuth2Client = new OAuth2Client(client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  return new Promise((res, rej) => {
    fs.readFile(TOKEN_PATH, (err, token) => {
      if (err) rej(getNewToken(oAuth2Client));
      oAuth2Client.setCredentials(JSON.parse(token));
      res(oAuth2Client);
    });
  });
}

/**
 * Get and store new token after prompting for user authorization
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 */
function getNewToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'online',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((good, bad) => {
    rl.question('Enter the code from that page here: ', (code) => {
      rl.close();
      oAuth2Client.getToken(code, (err, token) => {
        if (err) return bad(err);
        oAuth2Client.setCredentials(token);
        // Store the token to disk for later program executions
        fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
          if (err) console.error(err);
          console.log('Token stored to', TOKEN_PATH);
        });
        return good(oAuth2Client);
      });
    });
  });
}

/**
 * Prints the names and majors of students in a sample spreadsheet:
 */
function listMajors() {
  const sheets = google.sheets({
    version: 'v4',
    auth: 'AIzaSyCeDOH3eA99kHxZKoikw2Vg-pyBrpoAN1k'
  });
  return new Promise((good, bad) => {
    sheets.spreadsheets.values.get({
      spreadsheetId: '1oj1MBIlzoE5AhITjd0IDKyJQVr1uwN7IC0-9va5bNTs',
      range: 'Beer List - By Tasting!A2:CO',
    }, (err, {
      data
    }) => {
      if (err) return console.log('The API returned an error: ' + err);
      const rows = data.values;
      return good(rows);
    });
  }).catch(err => {
    console.log('(listMajors) Error', err);
  });
}

server.get('/', (req, res) => {
  res.send({
    'msg': `I'm Alive`
  })
});

server.get('/filter', (req, res) => {
  fs.readFile('client_secret.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    listMajors().then(rows => {
      let headers = rows[0];

      // Get a list of beer names
      let beerNames = [],
        companies = [];

      for (let row of rows) {
        if (row[2]) {
          beerNames.push(row[2]);
          companies.push(row[0]);
        }
      }

      // Let's create a set
      let companiesSet = new Set(companies);
      let companiesShortArray = Array.from(companiesSet);

      let name = req.query.name;
      if (!name) {
        res.send({
          beers: beerNames,
          companies: companiesShortArray
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
});

server.listen(process.env.PORT || 5555, () => {
  console.log('Which Beer now listening on port', process.env.PORT || 5555);
});

server.use(function (req, res, next) {
  res.sendFile(path.join(__dirname, '../public', '404.html'));
})

server.use(function (err, req, res, next) {
  res.sendFile(path.join(__dirname, '../public', '500.html'));
})