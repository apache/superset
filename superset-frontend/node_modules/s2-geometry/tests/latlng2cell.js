'use strict';

var S2 = require('../src/s2geometry.js').S2;

var level = 15;

// Provo, UT (Center St)
// '9749618446378729472' '4/032212303102210' '40.256312,-111.709298' 15
//                        4/032212303102210
//var lat = 40.2574448;
//var lng = -111.7089464;
var latlng = { lat: 40.256312, lng: -111.709298 };
var cell = S2.S2Cell.FromLatLng(latlng, level);

console.log(cell.toHilbertQuadkey(), '4/032212303102210' === cell.toHilbertQuadkey());
console.log(cell.getLatLng(), '40.256312,-111.709298' === cell.getLatLng(), '40.256312,-111.709298');

// Startup Building in Provo
// '9749615171466166272' '4/032212302322233' '40.226063,-111.664582' 15
//                        4/032212302322233
//var lat = 40.2262363;
//var lng = -111.6630927;
var latlng = { lat: 40.226063, lng: -111.664582 };
var cell = S2.S2Cell.FromLatLng(latlng, level);

console.log(cell.toHilbertQuadkey(), '4/032212302322233' === cell.toHilbertQuadkey());
console.log(cell.getLatLng(), '40.226063,-111.664582' === cell.getLatLng(), '40.226063,-111.664582');

/*
cell.getNeighbors();  // [ cellLeft, cellDown, cellRight, cellUp ]

latlng = cell.getLatLng();     // { lat: 40.2574448, lng: -111.7089464 }

console.log(orig);
console.log(latlng);

if (40 === Math.round(latlng.lat) && -112 === Math.round(latlng.lng)) {
  console.log('OK');
  process.exit(0);
}
else {
  console.log('[ERROR] latitude and longitude were not the expected values:');
  console.log(latlng);
  process.exit(1);
}
*/
