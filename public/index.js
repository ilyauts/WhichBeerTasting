const removeDiacritics = require('diacritics').remove;
const $ = require('jquery');
const axios = require('axios');
const Chart = require('chart.js');

const data = {
    companies: [],
    beers: [],
    attendees: [],
    total: [],
    myChart: {}
};

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
                if (data.total[i][j] !== '...') {
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
            let idx = $(el).data('index');
            if (data.total[idx][index] !== '...' && data.total[idx][index] !== undefined) {
                $(el).find('.your-rating').text(data.total[idx][index] * 10 + '%');
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

        let personAllBeers = [];
        let person2019Beers = [];
        let bucketedRatings = {'1': 0, '1.5': 0, '2': 0, '2.5': 0, '3': 0, '3.5': 0, '4': 0, '4.5': 0, '5': 0, '5.5': 0, '6': 0, '6.5': 0, '7': 0, '7.5': 0, '8': 0, '8.5': 0, '9': 0, '9.5': 0, '10': 0};
        // Counting and math
        for (let i = 0; i < data.total.length; ++i) {
            // Have we gone too far?
            if (data.total[i][0].indexOf('STDEV') !== -1) {
                break;
            }

            let currScore = Number(data.total[i][selectedPerson]);
            if (!isNaN(currScore)) {
                if (typeof personTypeMap[data.total[i][1]] === 'undefined') {
                    personTypeMap[data.total[i][1]] = 0;
                    personTypeMap[data.total[i][1] + '-count'] = 0;
                }

                personTypeMap.count++;
                personTypeMap.allTypes += currScore;
                personTypeMap[data.total[i][1]] += currScore;
                personTypeMap[data.total[i][1] + '-count']++;

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

        let labels = (Object.keys(bucketedRatings).map(a => Number(a))).sort((a,b) => a - b);

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

});