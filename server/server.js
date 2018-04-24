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
 * Prints the names and majors of students in a sample spreadsheet:
 */
function listMajors() {
  const sheets = google.sheets({
    version: 'v4',
    auth: process.env.GOOGLE_TOKEN || '<YOUR GOOGLE TOKEN HERE>'
  });
  return new Promise((good, bad) => {
    sheets.spreadsheets.values.get({
      spreadsheetId: '1oj1MBIlzoE5AhITjd0IDKyJQVr1uwN7IC0-9va5bNTs',
      range: 'Beer List - By Tasting!A1:CO',
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
  listMajors().then(rows => {
    let headers = rows[0];

    // Get a list of beer names
    let beerNames = [],
      companies = [];

    // Let's remove the first row
    rows.splice(0,1);

    // Now go through all the data
    for (let row of rows) {
      // No script tags here...
      if(validText(row[0])) {
        companies.push(row[0]);
      }
      if(validText(row[2])) {
        beerNames.push(row[2]);
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

function validText(text) {
  return (text && !text.includes('<'));
}

server.listen(process.env.PORT || 5555, () => {
  console.log('Which Beer now listening on port', process.env.PORT || 5555);
});