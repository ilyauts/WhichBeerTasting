const removeDiacritics = require('diacritics').remove;
    const $ = require('jquery');
    const axios = require('axios');

$(document).ready(function () {

    let data = {
        companies: [],
        beers: []
    };

    // Load beers
    axios({
        url: '/filter',
        method: 'get',
    }).then(response => {
        // Clear old list
        $('#beer-companies').empty();
        $('#beer-names').empty();

        data = response.data;

        // Push beers
        for (let beer of data.beers) {
            $('#beer-names').append('<p data-beer="' + beer + '">' + beer + '</p>');
        }

        // Push companies
        for (let company of data.companies) {
            $('#beer-companies').append('<p data-company="' + company + '">' + company + '</p>');
        }
    }).catch(err => {
        console.log('FE Error', err);
    });


    $("#query").on("change paste keyup", function () {
        if (this && $(this)) {
            frontEndFilter($(this).val());
        }
    });

    function frontEndFilter(filter) {
        // Loop through all the companies and the beers
        let beers = $('#beer-names p');
        let companies = $('#beer-companies p');

        for(let beer of beers) {
            let currBeerName = $(beer).data('beer').toString();
            if(currBeerName && removeDiacritics(currBeerName.toLowerCase()).includes(removeDiacritics(filter.toLowerCase()))) {
                $(beer).show();
            } else {
                $(beer).hide();
            }
        }
        for(let company of companies) {
            let currCompName = $(company).data('company').toString();
            if(currCompName && removeDiacritics(currCompName.toLowerCase()).includes(removeDiacritics(filter.toLowerCase()))) {
                $(company).show();
            } else {
                $(company).hide();
            }
        }
    }

});