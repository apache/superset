'use strict';

var jS2 = require('../src/s2geometry.js').S2;
var nS2 = require('s2geometry-node');

var x, y;

function checkReal(lat, lng) {
  var nS2LatLng = new nS2.S2LatLng(lat, lng).toPoint();
  var nCell = new nS2.S2CellId(nS2LatLng).parent(15);
  var jCell = jS2.S2Cell.FromLatLng({ lat: lat, lng: lng }, 15);
  var nKey = nCell.toString();
  var jQuad = jCell.getFaceAndQuads();
  var jKey = jQuad[0] + '/' + jQuad[1].join('');

  if (nKey !== jKey) {
    console.log('');
    console.log('Quadkey');
    console.log('=', nKey);
    console.log('j', jKey);
    throw new Error("values didn't match expected");
  }
}

console.log('Exhaustive check of about 518,400 random lat,lng coordinates of the earth (about every 0.5°)');
console.log('(this will take several seconds)');
for (x = -180; x <= 180; x += (0 + Math.random())) {
  for (y = -180; y <= 180; y += (0 + Math.random())) {
    checkReal(x, y);
  }
}
console.log('PASS');
