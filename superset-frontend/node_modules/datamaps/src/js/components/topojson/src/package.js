require("../topojson");

console.log(JSON.stringify({
  "name": "topojson",
  "version": topojson.version,
  "description": "An extension to GeoJSON that encodes topology.",
  "keywords": [
    "geojson",
    "shapefile"
  ],
  "author": {
    "name": "Mike Bostock",
    "url": "http://bost.ocks.org/mike"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/mbostock/topojson.git"
  },
  "main": "./index.js",
  "dependencies": {
    "dsv": "0.0",
    "optimist": "0.3",
    "queue-async": "1.0",
    "shapefile": "0.1"
  },
  "devDependencies": {
    "vows": "0.7",
    "us-atlas": "0.0",
    "world-atlas": "0.0"
  },
  "bin": {
    "topojson": "./bin/topojson",
    "geojson": "./bin/geojson"
  },
  "scripts": {
    "test": "./node_modules/.bin/vows && echo"
  }
}, null, 2));
