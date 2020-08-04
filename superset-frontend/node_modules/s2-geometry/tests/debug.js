'use strict';

//var oS2 = require('./s2geometry.old.js').S2;
var jS2 = require('../src/s2geometry.js').S2;
var nS2 = require('s2geometry-node');

var lat = -43.525166;
var lng = 172.655096;
//var id = '8678661352471920640';

var tests = [
  [ -13.846153846153854, -41.53846153846155 ]   // face 0
, [ -13.846153846153854, 96.92307692307692 ]    // face 1
, [ 41.53846153846153, -124.61538461538463 ]    // face 2
, [ -152.30769230769232, 41.53846153846153 ]    // face 3
, [ -152.30769230769232, 69.23076923076923 ]    // face 4
, [ -124.61538461538463, -69.23076923076924 ]   // face 5
];

var tests = [
  [ -3.9832738, 12.6825449,   'The Congo          (Africa)' ]
, [ 19.0827696, 72.7407752,   'Mumbai, India      (Asia)' ]
, [ 68.5207533, -74.9563282,  'Greenland          (North Pole)' ]
, [ -1.573289, -158.957890,   'The Pacific Ocean  (nowhere)' ]
, [ 40.2573137, -111.7091177, 'Provo, UT, USA     (Americas)' ]
, [ -46.362972,-73.7431064,   'Antarctica         (South Pole)' ]
];

var bugReports = [
  // https://github.com/jonatkins/s2-geometry-javascript/issues/12
  [ -6.120097, 106.846511, '@Skeec' ]
  // https://github.com/coolaj86/s2-geometry-javascript/issues/8#issuecomment-237204759
, [ -33.87347601637759, 151.1954084522501 ]
  // https://github.com/Daplie/s2-geometry.js/issues/1
, [ 45.74528835847731, 12.5516625, '@vekexasia' ]
];

tests.concat(bugReports).forEach(function (pair, i) {
  var lat = pair[0];
  var lng = pair[1];
  var comment = pair[2] && ('(' + pair[2] + ')') || '';

  console.log('');
  console.log('');

  if (i < 6) {
    console.log('FACE', i);
  }
  console.log('Lat/Lng', '=', lat + ',' + lng, comment);

  //
  // Lat / Lng to XYZ
  //
  var nS2LatLng = new nS2.S2LatLng(lat, lng).toPoint();
  //var nXyz = [ nS2LatLng.x(), nS2LatLng.y(), nS2LatLng.z() ];
  //var jXyz = jS2.LatLngToXYZ({ lat: lat, lng: lng });
  /*
  console.log('');
  console.log('XYZ');
  console.log('=', nXyz);
  console.log('j', jXyz);
  */


  var nCell = new nS2.S2CellId(nS2LatLng).parent(15);
  var jCell = jS2.S2Cell.FromLatLng({ lat: lat, lng: lng }, 15);
  /*
  console.log('');
  console.log('F,IJ,L');
  console.log('j', jCell.toString());
  */

  var nKey = nCell.toString();
  var jQuad = jCell.getFaceAndQuads();
  var jKey = jQuad[0] + '/' + jQuad[1].join('');
  console.log('Quadkey');
  console.log('=', nKey);
  console.log('j', jKey, "(" + jS2.toId(jKey) + ")");
});
