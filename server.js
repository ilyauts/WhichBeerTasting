const express = require('express'),
  server = express(),
  bodyParser = require('body-parser'),
  countries = require("i18n-iso-countries");;

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
      companies = [],
      locations = [];
    
    // Now go through all the data
    for (let rowIndex = 1; rowIndex < rows.length; ++rowIndex) {

      // No script tags here...
      if (validText(rows[rowIndex][0])) {
        companies.push(rows[rowIndex][0]);
      }
      if (validText(rows[rowIndex][2])) {
        beerNames.push(rows[rowIndex][2]);
      }
      if (validText(rows[rowIndex][2])) {
        locations.push(rows[rowIndex][3]);
      }
    }  
    
    // Average ratings column
    let avgRtgs = -1;
    for(let i = 0; i < rows[0].length; ++i) {
      if(rows[0][i] === 'Avg. Rating') {
        avgRtgs = i;
        break;
      }
    }

    // Let's create a set
    let companiesSet = new Set(companies);
    let companiesShortArray = Array.from(companiesSet);

    // Get country codes and state codes
    let countryCodes = {
      USA: {
        count: 0,
        ratings: 0,
        rows: []
      }
    };
    let stateCodes = {};
    for(var idx = 1; idx < locations.length; ++idx) {
        let d = locations[idx];

        if(d.indexOf(',') !== -1) {
            let currLocation = d.substring(d.indexOf(',') + 1).trim();

            // Remove any states
            if(currLocation <= 1) {
              continue;
            } else if(currLocation.length === 2) {
              if(typeof stateCodes[currLocation] !== 'undefined') {
                stateCodes[currLocation].count++;
                stateCodes[currLocation].ratings += stripPercent(rows[idx][avgRtgs]);
                stateCodes[currLocation].rows.push(idx);
              } else {
                stateCodes[currLocation] = {
                  state: currLocation,
                  count: 1,
                  ratings: stripPercent(rows[idx][avgRtgs]),
                  rows: [idx]
                };
              }

              // Add for the country too
              countryCodes['USA'].count++;
              countryCodes['USA'].ratings += stripPercent(rows[idx][avgRtgs]);
              countryCodes['USA'].rows.push(idx);
            } else {
              // Convert to code
              currLocation = countries.getAlpha3Code(currLocation, 'en');

              // Add if not null
              if(currLocation !== null && typeof currLocation !== 'undefined') {
                if(typeof countryCodes[currLocation] !== 'undefined') {
                  countryCodes[currLocation].count++;
                  countryCodes[currLocation].ratings += stripPercent(rows[idx][avgRtgs]);
                  countryCodes[currLocation].rows.push(idx);
                } else {
                  countryCodes[currLocation] = {
                    country: currLocation,
                    count: 1,
                    ratings: stripPercent(rows[idx][avgRtgs]),
                    rows: [idx]
                  };
                }
              }
            }
        }
    }

    // Avg the ratings
    for(let s in stateCodes) {
      if(stateCodes.hasOwnProperty(s)) {
        stateCodes[s].ratings /= stateCodes[s].count;
      }
    }

    for(let s in countryCodes) {
      if(countryCodes.hasOwnProperty(s)) {
        countryCodes[s].ratings /= countryCodes[s].count;
      }
    }
    
    let name = req.query.name;
    if (!name) {
      res.send({
        beers: beerNames,
        companies: companiesShortArray,
        countryCodes,
        stateCodes,
        locations,
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

function stripPercent(num) {
  if(num[num.length - 1] === '%') {
    return Number(num.substring(0, num.length - 1));
  } else {
    return Number(num);
  }
}

server.listen(process.env.PORT || 5555, () => {
  console.log('Which Beer now listening on port', process.env.PORT || 5555);
});