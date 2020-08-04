[![npm version](https://badge.fury.io/js/%40mapbox%2Fwhoots-js.svg)](https://badge.fury.io/js/%40mapbox%2Fwhoots-js)
[![Build Status](https://secure.travis-ci.org/mapbox/whoots-js.svg)](http://travis-ci.org/mapbox/whoots-js)
[![Coverage Status](https://coveralls.io/repos/github/mapbox/whoots-js/badge.svg?branch=master)](https://coveralls.io/github/mapbox/whoots-js?branch=master)


## whoots-js

Request tiles from WMS servers that support EPSG:3857.

This project is a JavaScript port of https://github.com/timwaters/whoots by Tim Waters.


### What is it?

Given a `z/x/y` tile coordinate like `19/154308/197167`, `whoots-js` can request imagery from an EPSG:3857 supporting WMS server like this:

```
http://geodata.state.nj.us/imagerywms/Natural2015?
  bbox=-8242663.382160267,4966572.349857613,-8242586.945131982,4966648.786885899
  &format=image/png&service=WMS&version=1.1.1&request=GetMap&srs=EPSG:3857
  &width=256&height=256&layers=Natural2015
```


### Usage

```js
var WhooTS = require('@mapbox/whoots-js');

// Get an image url for a given tile coordinate
var baseUrl = 'http://geodata.state.nj.us/imagerywms/Natural2015';
var layer = 'Natural2015';
var url = WhooTS.getURL(baseUrl, layer, 154308, 197167, 19);
```


### Server

This project includes a sample redirecting wms proxy server in `server.js`.

`npm run server` will start a local server on port 8080 that redirects tile requests.

Valid tile requests look like:

```
http://localhost:8080/tms/{z}/{x}/{y}/{layer}/{endpoint}
http://localhost:8080/tms/19/154308/197167/Natural2015/http://geodata.state.nj.us/imagerywms/Natural2015
```


### Documentation

Complete API documentation is here:  http://mapbox.github.io/whoots-js/
