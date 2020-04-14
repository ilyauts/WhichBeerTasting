const removeDiacritics = require('diacritics').remove;
const $ = require('jquery');
const axios = require('axios');
const Chart = require('chart.js');
const Js2WordCloud = require('js2wordcloud');

const data = {
    companies: [],
    beers: [],
    locations: [],
    countryCodes: [],
    stateCodes: [],
    attendees: [],
    total: [],
    myChart: {}
};

// Store in the window for later
window.data = data;

$(document).ready(function () {

    // Load beers
    axios({
        url: '/filter',
        method: 'get',
    }).then(response => {
        // Clear old list
        $('#beer-companies').empty();
        $('#beer-names').empty();

        let respData = response.data;

        // Start by determining the number of attendees
        let initialIndex, finalIndex, companyIndex, beerIndex, avgIndex, finalRow;

        // Get rid of all the blank entries
        respData.total = respData.total.filter(currRow => (currRow[0] !== undefined && currRow[0] !== 'Count' && currRow[0] !== 'AVG' && currRow[0] !== 'STDEV'));

        for (let dIndex in respData.total[0]) {
            if (respData.total[0][dIndex] === 'Company Name') {
                companyIndex = parseInt(dIndex);
            } else if (respData.total[0][dIndex] === 'Beer Name') {
                beerIndex = parseInt(dIndex);
            } else if (respData.total[0][dIndex] === 'Location') {
                initialIndex = parseInt(dIndex) + 1;
            } else if (respData.total[0][dIndex] === 'Avg. Rating') {
                finalIndex = parseInt(dIndex);
                avgIndex = parseInt(dIndex);
                break;
            }
        }

        // Cache
        data.beers = respData.beers;
        data.companies = respData.companies;
        data.locations = respData.locations;
        data.countryCodes = respData.countryCodes;
        data.stateCodes = respData.stateCodes;
        data.attendees = respData.total[0].map((person, pIndex) => {
            if (pIndex >= initialIndex && pIndex < finalIndex) {
                return { index: pIndex, name: person };
            }
        }).filter(person => person);

        // Populate the dropdown
        let options = data.attendees.map(datum => $('<option>', {
            'data-index': datum.index,
            text: datum.name
        }));
        $('#attendee').append(options);

        // Listen to when person is selected
        $('#attendee').change(e => {
            populateForPerson.call(this, $(this).find(':selected').data('index'));

            if(typeof $(this).find(':selected').data('index') === 'undefined') {
                $('#had-switch-container').addClass('hide-me');
            } else {
                $('#had-switch-container').removeClass('hide-me');
            }
        });

        // Listen to when the filter of tasted beers changes
        $('#had-switch').change(e => {
            const val = $('#had-switch option:selected').val();
            $('#beer-table').removeClass('have-had have-not-had');

            switch (val) {
                case 'mine':
                    console.log(1111, $('#beer-table'))
                    $('#beer-table').addClass('have-had');
                    break;
                case 'theirs':
                    $('#beer-table').addClass('have-not-had');
                    break;
            }
        });

        // Store entirety
        data.total = respData.total;

        // Generate beer table
        let newTable = [];
        for (let i = 1; i < data.total.length; ++i) {
            newTable.push($('<tr>', {
                'class': 'beer-list-tr',
                'data-beer': removeDiacritics(data.total[i][beerIndex]).toLowerCase(),
                'data-company': removeDiacritics(data.total[i][companyIndex]).toLowerCase(),
                'data-index': i
            }).append($('<td>', {
                class: 'company',
                text: data.total[i][companyIndex]
            })).append($('<td>', {
                class: 'beer',
                text: data.total[i][beerIndex]
            })).append($('<td>', {
                class: 'avg-rating',
                text: data.total[i][avgIndex]
            })).append($('<td>', {
                class: 'your-rating',
                text: '...'
            })));
        }
        $('#beer-table tbody').append(newTable);

        // Generate leaderboard table
        let leaderObj = {};
        for (let i = 1; i < data.total.length; ++i) {
            for (let j = initialIndex; j < finalIndex; ++j) {
                if (!isNaN(parseFloat(data.total[i][j]))) {
                    // Check if item already exists
                    if (leaderObj[j] && data.total[i][j].length) {
                        leaderObj[j].count++;
                        leaderObj[j].sum += parseFloat(data.total[i][j]);
                    } else {
                        leaderObj[j] = {
                            count: 1,
                            sum: parseFloat(data.total[i][j]),
                            name: data.total[0][j]
                        }
                    }
                }
            }
        }

        // Find average
        let newTableLeaderboard = [];
        for (let key of Object.keys(leaderObj)) {
            leaderObj[key].avg = leaderObj[key].sum / leaderObj[key].count;
            newTableLeaderboard.push(leaderObj[key]);
        }

        // Sort
        newTableLeaderboard.sort((a, b) => {
            return b.count - a.count;
        })

        let jTableLeaderboard = [];
        for (let i = 0; i < newTableLeaderboard.length; ++i) {
            jTableLeaderboard.push($('<tr>', {
                'data-index': i + 1
            }).append($('<td>', {
                class: 'rank' + leaderColor(i),
                text: i + 1
            })).append($('<td>', {
                class: 'name' + leaderColor(i),
                text: newTableLeaderboard[i].name
            })).append($('<td>', {
                class: 'num-beers' + leaderColor(i),
                text: newTableLeaderboard[i].count
            })).append($('<td>', {
                class: 'avg-rating' + leaderColor(i),
                text: cleverRound(newTableLeaderboard[i].avg)
            })));

            // Determine if all-star
            if (newTableLeaderboard[i].count >= 150) {
                jTableLeaderboard[jTableLeaderboard.length - 1].find('.name').html(newTableLeaderboard[i].name + ' <span class="all-star">&#9733;<span>')
            }
        }
        $('#leaderboard-table tbody').append(jTableLeaderboard);

        // Populate the maps
        populateMaps();

        //! Analytics section
        // Fill in names in analytics select
        // Need to make a clone otherwise you get into some weird reference issues
        const optionsCloned = options.map(option => option.clone());
        $('#analytics_select').append(optionsCloned).on('change', populateAnalyticsForPerson);
    }).catch(err => {
        console.log('FE Error', err);
    });


    $("#query").on("input", function () {
        if (this && $(this)) {
            frontEndFilter($(this).val());
        }
    });

    $('.analytics-button').on('click', function (e) {
        const jTarget = $(e.target);

        // If active one selected, do nothing
        if (jTarget.hasClass('active')) {
            return;
        }

        // Get rid of all warning classes on buttons
        $('.btn-warning').removeClass('btn-warning active');

        // Hide all sections
        $('.analytics-sub-section').addClass('hide-me');

        // Add the classes to this button
        jTarget.addClass('btn-warning active');

        // Show the current active section
        $('.analytics-sub-section[data-label="' + jTarget.attr('data-selection') + '"]').removeClass('hide-me');

        // Initialize the word cloud
        if (jTarget.attr('data-selection') === 'avg') {
            $('#style-avg-word-map').html('')

            const cloudData = $('#style-avg-word-map').closest('[data-label="avg"]').data('cloudData');
            const wc = new Js2WordCloud(document.getElementById('style-avg-word-map'))
            wc.setOption({
                // imageShape: '/assets/beer.png',
                tooltip: {
                    show: true
                },
                fontSizeFactor: 2,
                maxFontSize: 45,
                minFontSize: 8,
                list: cloudData,
                color: function (word, weight, fontSize, distance, theta) {
                    // Randomly return one of these colors
                    const colorArr = ['#eca21c', '#fff', '#808080', '#b27609'];
                    return colorArr[Math.floor(Math.random() * colorArr.length)];
                },
                backgroundColor: '#000',
                gridSize: 20
            })
        } else if (jTarget.attr('data-selection') === 'maps') {
            $('#company-word-cloud').html('')
            $('#company-word-cloud-frequency').html('')

            const cloudData = $('#company-word-cloud').closest('[data-label="maps"]').data('cloudData');
            const wc = new Js2WordCloud(document.getElementById('company-word-cloud'))
            wc.setOption({
                // imageShape: '/assets/beer.png',
                tooltip: {
                    show: true
                },
                fontSizeFactor: 2,
                maxFontSize: 45,
                minFontSize: 8,
                list: cloudData,
                color: function (word, weight, fontSize, distance, theta) {
                    // Randomly return one of these colors
                    const colorArr = ['#eca21c', '#fff', '#808080', '#b27609'];
                    return colorArr[Math.floor(Math.random() * colorArr.length)];
                },
                backgroundColor: '#000',
                gridSize: 20
            });

            const cloudDataFrequency = $('#company-word-cloud-frequency').closest('[data-label="maps"]').data('cloudDataFrequency');
            const wc2 = new Js2WordCloud(document.getElementById('company-word-cloud-frequency'))
            wc2.setOption({
                // imageShape: '/assets/beer.png',
                tooltip: {
                    show: true
                },
                fontSizeFactor: 2,
                maxFontSize: 45,
                minFontSize: 8,
                list: cloudDataFrequency,
                color: function (word, weight, fontSize, distance, theta) {
                    // Randomly return one of these colors
                    const colorArr = ['#eca21c', '#fff', '#808080', '#b27609'];
                    return colorArr[Math.floor(Math.random() * colorArr.length)];
                },
                backgroundColor: '#000',
                gridSize: 20
            })

        }
    });

    $('#v-pills-maps-tab').on('click', function (e) {
        // Let's render the maps
        setTimeout(function () {
            populateMaps();
        }, 250);
    });

    $('#avg-query').on('input', function (e) {
        let table = $('#average-table');
        let input = removeDiacritics($(e.target).val());

        // Start by unhiding everything
        table.find('tr').removeClass('hide-me');
        if (input === '' || typeof input === 'undefined') {
            // Show all when empty
        } else {
            let normalizedInput = removeDiacritics(input).toLowerCase();
            table.find('tr:not(.header-tr)').each((idx, el) => {
                let text = $(el).find('td:first').text().toLowerCase();

                if (text.indexOf(normalizedInput) === -1) {
                    $(el).addClass('hide-me');
                }
            });
        }
    });

    function frontEndFilter(filter) {
        // Hide based on company and beer
        $("tr.beer-list-tr").show();
        if (filter === '' || filter === null || filter === undefined) {
            // Do nothing
        } else {
            let formattedFilter = removeDiacritics(filter).toLowerCase();
            $("tr.beer-list-tr:not([data-beer*='" + formattedFilter + "']):not(.header-tr)").hide();
            $("tr.beer-list-tr[data-company*='" + formattedFilter + "']:not(.header-tr)").show();
        }
    }

    function populateForPerson(index) {
        let trs = $("tr:not(.header-tr)").each((_, el) => {
            // Hide rows
            $(el).removeClass('filled-row');

            let idx = $(el).data('index');
            if (data.total[idx][index] !== '...' && data.total[idx][index] !== undefined) {
                $(el).find('.your-rating').text(data.total[idx][index] * 10 + '%');

                // Add class
                $(el).addClass('filled-row');

            } else {
                $(el).find('.your-rating').text('...');
            }
        });
    }

    function populateAnalyticsForPerson(e) {
        const jTarget = $(e.target);

        // Find selected person
        const selectedPerson = jTarget.find('option:selected').attr('data-index');

        // Get rid of all warning classes on buttons
        $('.btn-warning').removeClass('btn-warning active');

        // Hide all sections
        $('.analytics-sub-section').addClass('hide-me');

        // Fill out the average table first
        let avgTable = $('#average-table tbody');

        // Clear out old content
        avgTable.find('tr').remove();


        // Find averages by all types
        let personTypeMap = {
            count: 0,
            allTypes: 0
        };

        // Find counts by brewery
        let personBreweryMap = {
            count: 0
        };

        let personAllBeers = [];
        let person2019Beers = [];
        let bucketedRatings = { '1': 0, '1.5': 0, '2': 0, '2.5': 0, '3': 0, '3.5': 0, '4': 0, '4.5': 0, '5': 0, '5.5': 0, '6': 0, '6.5': 0, '7': 0, '7.5': 0, '8': 0, '8.5': 0, '9': 0, '9.5': 0, '10': 0 };
        // Counting and math
        for (let i = 0; i < data.total.length; ++i) {
            // Have we gone too far?
            if (data.total[i][0].indexOf('STDEV') !== -1) {
                break;
            }

            let currScore = Number(data.total[i][selectedPerson]);
            if (!isNaN(currScore) && currScore >= 1) {
                // Have we seen this type before?
                if (typeof personTypeMap[data.total[i][1]] === 'undefined') {
                    personTypeMap[data.total[i][1]] = 0;
                    personTypeMap[data.total[i][1] + '-count'] = 0;
                }

                // Have we seen this brewery before?
                if (typeof personBreweryMap[data.total[i][0]] === 'undefined') {
                    personBreweryMap[data.total[i][0]] = 0
                    personBreweryMap[data.total[i][0] + '-count'] = 0
                }

                // List that we've found the type
                personTypeMap.count++;
                personTypeMap.allTypes += currScore;
                personTypeMap[data.total[i][1]] += currScore;
                personTypeMap[data.total[i][1] + '-count']++;

                // And the brewery
                personBreweryMap[data.total[i][0]] += currScore;
                personBreweryMap[data.total[i][0] + '-count']++;

                // Add to all beers list
                personAllBeers.push({
                    index: i,
                    beerName: data.total[i][2],
                    beerCompany: data.total[i][0],
                    score: currScore
                });

                // Should we add it to 2019 year's analytics?
                const starting2019Row = 343;
                if (i >= starting2019Row) {
                    person2019Beers.push({
                        index: i,
                        beerName: data.total[i][2],
                        beerCompany: data.total[i][0],
                        score: currScore
                    });
                }

                // Add to buckets
                bucketedRatings[currScore]++;
            }
        }
        console.log(1111111, personBreweryMap)

        // Sort the analytics
        personAllBeers.sort((a, b) => {
            let toReturn = -1 * (a.score - b.score);

            if (toReturn === 0) {
                return ((a.beerName > b.beerName) ? 1 : -1);
            } else {
                return toReturn;
            }
        });
        person2019Beers.sort((a, b) => {
            let toReturn = -1 * (a.score - b.score);

            if (toReturn === 0) {
                return ((a.beerName > b.beerName) ? 1 : -1);
            } else {
                return toReturn;
            }
        });

        // Clear old data
        $('#beer-table-all-top tbody tr').remove();
        $('#beer-table-all-bottom tbody tr').remove();

        // Populate top 10 beers
        for (let i = 0; (i < personAllBeers.length && i < 10); ++i) {
            $('#beer-table-all-top tbody').append($('<tr>')
                .append($('<td>', { text: personAllBeers[i].beerCompany }))
                .append($('<td>', { text: personAllBeers[i].beerName }))
                .append($('<td>', { text: personAllBeers[i].score })));

            $('#beer-table-all-bottom tbody').append($('<tr>')
                .append($('<td>', { text: personAllBeers[personAllBeers.length - i - 1].beerCompany }))
                .append($('<td>', { text: personAllBeers[personAllBeers.length - i - 1].beerName }))
                .append($('<td>', { text: personAllBeers[personAllBeers.length - i - 1].score })));
        }

        // Clear all old data
        $('#beer-table-2019-top tbody tr').remove();
        $('#beer-table-2019-bottom tbody tr').remove();

        // Populate top 10 beers for 2019
        for (let i = 0; (i < person2019Beers.length && i < 10); ++i) {
            $('#beer-table-2019-top tbody').append($('<tr>')
                .append($('<td>', { text: person2019Beers[i].beerCompany }))
                .append($('<td>', { text: person2019Beers[i].beerName }))
                .append($('<td>', { text: person2019Beers[i].score })));

            $('#beer-table-2019-bottom tbody').append($('<tr>')
                .append($('<td>', { text: person2019Beers[person2019Beers.length - i - 1].beerCompany }))
                .append($('<td>', { text: person2019Beers[person2019Beers.length - i - 1].beerName }))
                .append($('<td>', { text: person2019Beers[person2019Beers.length - i - 1].score })));
        }

        // Static content first
        avgTable.append($('<tr>', {
        }).append($('<td>', {
            text: 'All Beers'
        })).append($('<td>', {
            text: (personTypeMap['allTypes'] / personTypeMap['count']).toFixed(2)
        })).append($('<td>', {
            text: personTypeMap['count']
        })));

        // Loop again to find the averages
        let toPrint = [];
        for (let p in personTypeMap) {
            if (personTypeMap.hasOwnProperty(p)) {
                if (p.indexOf('-count') === -1 && p.indexOf('allTypes') === -1 && p.indexOf('count') === -1) {
                    // Find type averages
                    personTypeMap[p] /= personTypeMap[p + '-count'];

                    toPrint.push({
                        name: p,
                        score: personTypeMap[p],
                        count: personTypeMap[p + '-count']
                    });
                } else if (p === 'allTypes') {
                    personTypeMap[p] /= personTypeMap['count'];
                }
            }
        }

        // Sort the toPrint array
        toPrint.sort((a, b) => {
            return (a.score > b.score) ? -1 : 1;
        });

        // And for breweries too
        let toPrintBrewery = [];
        for (let p in personBreweryMap) {
            if (personBreweryMap.hasOwnProperty(p)) {
                if (p.indexOf('-count') === -1 && p.indexOf('allTypes') === -1 && p.indexOf('count') === -1) {
                    // Find type averages
                    personBreweryMap[p] /= personBreweryMap[p + '-count'];

                    toPrintBrewery.push({
                        name: p,
                        score: personBreweryMap[p],
                        count: personBreweryMap[p + '-count']
                    });
                }
            }
        }

        // Sort the toPrint array
        toPrintBrewery.sort((a, b) => {
            return (a.score > b.score) ? -1 : 1;
        });

        toPrint.forEach(el => {
            // Add to table
            avgTable.append($('<tr>', {
            }).append($('<td>', {
                text: el.name
            })).append($('<td>', {
                text: el.score.toFixed(2)
            })).append($('<td>', {
                text: el.count
            })));
        });

        let labels = (Object.keys(bucketedRatings).map(a => Number(a))).sort((a, b) => a - b);

        let bucketsArr = [];
        labels.forEach(val => {
            bucketsArr.push(bucketedRatings[val]);
        });

        // Remove old chart
        var jParent = $('#rating-diagram').parent();
        $('#rating-diagram').remove();

        // Take its place with the same element
        jParent.append($('<canvas>', {
            id: "rating-diagram",
            width: "400",
            height: "200"
        }));

        // Create the chart
        data.myChart = new Chart($('#rating-diagram')[0], {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    data: bucketsArr,
                    borderColor: '#6b4a0e',
                    backgroundColor: '#6b4a0e',
                    hoverBackgroundColor: '#eca21c'
                }]
            },
            options: {
                legend: {
                    display: false
                },
                scales: {
                    xAxes: [{
                        gridLines: {
                            offsetGridLines: true
                        },
                        scaleLabel: {
                            display: true,
                            labelString: 'Rating'
                        }
                    }],
                    yAxes: [{
                        gridLines: {
                            offsetGridLines: true
                        },
                        scaleLabel: {
                            display: true,
                            labelString: 'Frequency'
                        }
                    }]
                }
            }
        });

        // Show the below section
        $('#analytics-post-select').removeClass('hide-me');

        // Let's create an array for the wordcloud map
        const wordCloudData = toPrint.map((val) => ([val.name, (val.score)]));
        $('#style-avg-word-map').css('height', '75vh');
        $('#style-avg-word-map').css('width', '60vw');
        $('#style-avg-word-map').closest('[data-label="avg"]').data('cloudData', wordCloudData);

        // Same thing for breweries now
        const wordCloudBreweryData = toPrintBrewery.map((val) => ([val.name, (val.score)]));
        $('#company-word-cloud').css('height', '75vh');
        $('#company-word-cloud').css('width', '60vw');
        $('#company-word-cloud').closest('[data-label="maps"]').data('cloudData', wordCloudBreweryData);

        // Same thing for breweries now
        const wordCloudBreweryFrequencyData = toPrintBrewery.map((val) => ([val.name, (val.count)]));
        $('#company-word-cloud-frequency').css('height', '75vh');
        $('#company-word-cloud-frequency').css('width', '60vw');
        $('#company-word-cloud-frequency').closest('[data-label="maps"]').data('cloudDataFrequency', wordCloudBreweryFrequencyData);
    }

    function cleverRound(num) {
        return Math.floor(num * 100) / 100;
    }

    function leaderColor(i) {
        if (i == 0) {
            return ' gold';
        } else if (i == 1) {
            return ' silver';
        } else if (i == 2) {
            return ' bronze';
        }

        return '';
    }

    function populateMaps() {
        let countryBeerData = {};
        let stateBeerData = {};

        // Loop through all the countries and color them
        for (let cc in data.countryCodes) {
            if (data.countryCodes.hasOwnProperty(cc)) {
                let curr = data.countryCodes[cc];
                countryBeerData[cc] = {
                    fillKey: 'beersTasted',
                    ratings: curr.ratings,
                    count: curr.count
                }
            }
        }

        // Fill out the main map
        $('#main-map').html('');
        var map = new Datamap({
            element: document.getElementById('main-map'),
            fills: {
                defaultFill: "#d2b48c",
                beersTasted: "#eca21c"
            },
            geographyConfig: {
                highlightBorderColor: '#bada55',
                popupTemplate: function (geography, data) {
                    return '<div class="hoverinfo"><strong>' + geography.properties.name + '</strong></br>Avg Rating: ' + Math.round(data.ratings) + '%</br>Count: ' + data.count + '</div>'
                }
            },
            data: countryBeerData
        });

        // Loop through all the states and do the same
        for (let cc in data.stateCodes) {
            if (data.stateCodes.hasOwnProperty(cc)) {
                let curr = data.stateCodes[cc];
                stateBeerData[cc] = {
                    fillKey: 'beersTasted',
                    ratings: curr.ratings,
                    count: curr.count
                }
            }
        }

        // Fill out the main map
        $('#usa-map').html('');
        var usaMap = new Datamap({
            scope: 'usa',
            element: document.getElementById('usa-map'),
            fills: {
                defaultFill: "#d2b48c",
                beersTasted: "#eca21c"
            },
            geographyConfig: {
                highlightBorderColor: '#bada55',
                popupTemplate: function (geography, data) {
                    return '<div class="hoverinfo"><strong>' + geography.properties.name + '</strong></br>Avg Rating: ' + Math.round(data.ratings) + '%</br>Count: ' + data.count + '</div>'
                }
            },
            data: stateBeerData
        });
    }

    // Maps for individuals instead
    $('body').on('click', '[data-selection="maps"]', function (e) {
        let countryBeerData = {};
        let stateBeerData = {};

        let personColumn = $('#analytics_select option:selected').attr('data-index');

        // First make a copy of the global count, and instead filter it down to the personal count
        let toDelete = [];
        let personalCountryCodes = JSON.parse(JSON.stringify(data.countryCodes));
        for (let l in personalCountryCodes) {
            if (personalCountryCodes.hasOwnProperty(l)) {
                let curr = personalCountryCodes[l];

                // Clear count and avg ratings
                curr.count = 0;
                curr.ratings = 0;

                // Loop through all rows, and remove any that don't belong there
                for (let r = curr.rows.length - 1; r >= 0; r--) {
                    let currR = curr.rows[r];
                    if (data.total[currR + 1][personColumn] === '...' || data.total[currR + 1][personColumn] === '') {
                        curr.rows.splice(r, 1);
                    } else {
                        curr.count++;
                        curr.ratings += Number(data.total[currR + 1][personColumn]);
                    }
                }

                // If count still zero - delete key
                if (curr.count === 0) {
                    delete personalCountryCodes[l];
                } else {
                    curr.ratings = (curr.ratings * 10) / curr.count;
                }
            }
        }

        // Loop through all the countries and color them
        for (let cc in personalCountryCodes) {
            if (personalCountryCodes.hasOwnProperty(cc)) {
                let curr = personalCountryCodes[cc];
                countryBeerData[cc] = {
                    fillKey: 'beersTasted',
                    ratings: curr.ratings,
                    count: curr.count
                }
            }
        }

        $('#main-map-personal').html('');
        var map = new Datamap({
            element: document.getElementById('main-map-personal'),
            fills: {
                defaultFill: "#d2b48c",
                beersTasted: "#eca21c"
            },
            geographyConfig: {
                highlightBorderColor: '#bada55',
                popupTemplate: function (geography, data) {
                    return '<div class="hoverinfo"><strong>' + geography.properties.name + '</strong></br>Avg Rating: ' + Math.round(data.ratings) + '%</br>Count: ' + data.count + '</div>'
                }
            },
            data: countryBeerData
        });


        // First make a copy of the global count, and instead filter it down to the personal count
        let personalStateCodes = JSON.parse(JSON.stringify(data.stateCodes));
        for (let l in personalStateCodes) {
            if (personalStateCodes.hasOwnProperty(l)) {
                let curr = personalStateCodes[l];

                // Clear count and avg ratings
                curr.count = 0;
                curr.ratings = 0;

                // Loop through all rows, and remove any that don't belong there
                for (let r = curr.rows.length - 1; r >= 0; r--) {
                    let currR = curr.rows[r];
                    if (data.total[currR + 1][personColumn] === '...' || data.total[currR + 1][personColumn] === '') {
                        curr.rows.splice(r, 1);
                    } else {
                        curr.count++;
                        curr.ratings += Number(data.total[currR + 1][personColumn]);
                    }
                }

                // If count still zero - delete key
                if (curr.count === 0) {
                    delete personalStateCodes[l];
                } else {
                    curr.ratings = (curr.ratings * 10) / curr.count;
                }
            }
        }

        // Loop through all the states and do the same
        for (let cc in personalStateCodes) {
            if (personalStateCodes.hasOwnProperty(cc)) {
                let curr = personalStateCodes[cc];
                stateBeerData[cc] = {
                    fillKey: 'beersTasted',
                    ratings: curr.ratings,
                    count: curr.count
                }
            }
        }

        // Fill out the main map
        $('#usa-map-personal').html('');
        var usaMap = new Datamap({
            scope: 'usa',
            element: document.getElementById('usa-map-personal'),
            fills: {
                defaultFill: "#d2b48c",
                beersTasted: "#eca21c"
            },
            geographyConfig: {
                highlightBorderColor: '#bada55',
                popupTemplate: function (geography, data) {
                    return '<div class="hoverinfo"><strong>' + geography.properties.name + '</strong></br>Avg Rating: ' + Math.round(data.ratings) + '%</br>Count: ' + data.count + '</div>'
                }
            },
            data: stateBeerData
        });
    });
});