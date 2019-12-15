# WhichBeerTasting
Have we had this beer at beer tasting yet?

## Google API Key
First generate a Google API Key link [here](https://developers.google.com/maps/documentation/javascript/get-api-key).

## Local Instructions
Replace **`<YOUR GOOGLE TOKEN HERE>`** with your Google API Key in server.js

To run, enter the following commands:

    npm install
    npm start

## Edits require browserify recomplication

Once you made any edits, make sure that you recompile the js files.

Start by Installing Browserify:

    npm i -g browserify

Now compile the js files into a bundle:

    cd public
    browserify 

You should be all set!

## In the wild
Use the version in production at [www.beertasting.life](http://beertasting.life)
