# WhereBeerTasting
Have we had this beer at beer tasting yet?

This app is meant to be deployed either locally or on IBM's Bluemix Cloud

## Google API Key
First generate a Google API Key: https://developers.google.com/maps/documentation/javascript/get-api-key

## Local Instructions
Replace '<YOUR GOOGLE TOKEN HERE>' with your Google token in server.js

## Bluemix Instructions
Follow the instructions here (https://github.com/ibm-watson-data-lab/--deprecated--simple-data-pipe/wiki/Create-a-user-defined-environment-variable-in-Bluemix) for setting your environment varible. Make sure to call it GOOGLE_TOKEN.

To run, enter the following commands:

    npm install
    npm start

