const removeDiacritics = require('diacritics').remove;
const $ = require('jquery');
const axios = require('axios');

$(document).ready(function () {

    const data = {
        companies: [],
        beers: [],
        attendees: [],
        total: []
    };

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
        respData.total = respData.total.filter(currRow => (currRow[0] !== undefined && currRow[0] !== 'Count' && currRow[0] !=='AVG' && currRow[0] !== 'STDEV'));

        for(let dIndex in respData.total[0]) {
            if(respData.total[0][dIndex] === 'Company Name') {
                companyIndex = parseInt(dIndex);
            } else if(respData.total[0][dIndex] === 'Beer Name') {
                beerIndex = parseInt(dIndex);
            } else if(respData.total[0][dIndex] === 'Location') {
                initialIndex = parseInt(dIndex) + 1;
            } else if(respData.total[0][dIndex] === 'Avg. Rating') {
                finalIndex = parseInt(dIndex);
                avgIndex = parseInt(dIndex);
                break;
            }
        }

        // Cache
        data.beers = respData.beers;
        data.companies = respData.companies;
        data.attendees = respData.total[0].map((person, pIndex) => {
            if(pIndex >= initialIndex && pIndex < finalIndex) {
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
        });


        // Store entirety
        data.total = respData.total;

        // Generate beer table
        let newTable = [];
        for(let i = 1; i < data.total.length; ++i) {
            newTable.push($('<tr>', {
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
        for(let i = 1; i < data.total.length; ++i) {
            for(let j = initialIndex; j < finalIndex; ++j) {
                if(data.total[i][j] !== '...') {
                    console.log(data.total[0][j]);
                    // Check if item already exists
                    if(leaderObj[j]) {
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
        for(let key of Object.keys(leaderObj)) {
            leaderObj[key].avg = leaderObj[key].sum / leaderObj[key].count;
            newTableLeaderboard.push(leaderObj[key]);
        }

        // Sort
        newTableLeaderboard.sort((a,b) => {
            return b.count - a.count;
        })

        let jTableLeaderboard = [];
        for(let i = 0; i < newTableLeaderboard.length; ++i) {
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
            if(newTableLeaderboard[i].count >= 150) {
                jTableLeaderboard[jTableLeaderboard.length - 1].find('.name').html(newTableLeaderboard[i].name + ' <span class="all-star">&#9733;<span>')
            }
        }
        $('#leaderboard-table tbody').append(jTableLeaderboard);

    }).catch(err => {
        console.log('FE Error', err);
    });


    $("#query").on("change paste keyup", function () {
        if (this && $(this)) {
            frontEndFilter($(this).val());
        }
    });

    function frontEndFilter(filter) {
        // Hide based on company and beer
        $("tr").show();
        if(filter === '' || filter === null || filter === undefined) {
            // Do nothing
        } else {
            let formattedFilter = removeDiacritics(filter).toLowerCase();
            $("tr:not([data-beer*='" + formattedFilter + "']):not(.header-tr)").hide();
            $("tr[data-company*='" + formattedFilter + "']:not(.header-tr)").show();
        }
    }

    function populateForPerson(index) {
        let trs = $("tr:not(.header-tr)").each((_, el) => {
            // console.log(data.total, idx, index);
            let idx = $(el).data('index');
            $(el).find('.your-rating').text(data.total[idx][index]);
        });
    }

    function cleverRound(num) {
        return Math.floor(num * 100) / 100;
    }

    function leaderColor(i) {
        if(i == 0) {
            return ' gold';
        } else if(i == 1) {
            return ' silver';
        } else if(i == 2) {
            return ' bronze';
        }

        return '';
    }

});