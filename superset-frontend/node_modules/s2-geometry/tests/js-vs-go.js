'use strict';

var tests = require('./generated-locations.json');
var jS2 = require('../src/s2geometry.js').S2;

function checkReal(loc) {
  var jCell = jS2.S2Cell.FromLatLng({ lat: loc.lat, lng: loc.lng }, 15);
  var jQuad = jCell.getFaceAndQuads();
  var jKey = jQuad[0] + '/' + jQuad[1].join('');

  if (loc.quadkey !== jKey) {
    loc.badFace = jCell.face;
    loc.badI = jCell.ij[0];
    loc.badJ = jCell.ij[1];
    loc.badQuad = jKey;
    loc.badId = jS2.toId(jKey);
    console.log(JSON.stringify(loc, null, '  ') + ',');
    console.log('');
    console.log('Lat/Lng:', loc.lat, loc.lng);
    console.log('');
    console.log('I, J:');
    console.log('=', loc.i, loc.j);
    console.log('j', jCell.ij.join(', '));
    console.log('');
    console.log('Quadkey');
    console.log('=', loc.quadkey);
    console.log('j', jKey);
    throw new Error("values didn't match expected");
  }
}

tests.forEach(checkReal);
console.log('PASS');
