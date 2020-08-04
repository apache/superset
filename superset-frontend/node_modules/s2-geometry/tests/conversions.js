'use strict';

var Long = require('long');
var s2node = require('s2geometry-node');
var S2 = require('../src/s2geometry.js').S2;

var tests = [
  { 'name': 'Provo, UT'
  , 'lat': 40.2574448
  , 'lng': -111.7089464
  , 'key': ''
  , 'id': ''
  }
, { 'name': 'Startup Building'
  , 'lat': 40.2262363
  , 'lng': -111.6630927
  , 'key': ''
  , 'id': ''
  }
, { 'name': "Kyderman's"
  , 'lat': 51.352085106718384 // 51.352085106718384
  , 'lng': -2.9877930879592896 // -2.9877930879592896
  , 'key': ''
  , 'id': ''
  }
, { 'name': "Toeler's"
  , 'lat': -43.525166 // -43.5261282
  , 'lng': 172.655096 // 172.6561085
  , 'key': ''
  , 'id': ''
  }
/*
, { 'name': ""
  , 'lat': 0
  , 'lng': 0
  , 'key': ''
  , 'id': ''
  }
*/
];

// get known-expected values
tests.forEach(function (loc) {
  var level = 15;
  var s2nLatLng = new s2node.S2LatLng(loc.lat, loc.lng);
  var s2nId = new s2node.S2CellId(s2nLatLng).parent(level);
  var s2nCell = new s2node.S2Cell(s2nId);

  loc.face = s2nCell.face();
  loc.id = s2nId.id();
  loc.key = s2nId.toString();
  loc.lat = s2nId.toLatLng().toString().split(',')[0];
  loc.lng = s2nId.toLatLng().toString().split(',')[1];
  loc.level = s2nId.level(); // always 15
  loc.point = s2nId.toPoint()// .toArray();

  //console.log(JSON.stringify(loc, null, '  '));

  var key = S2.latLngToQuadkey(loc.lat, loc.lng, level);
  var id = S2.toId(key);
  var key2 = S2.toKey(id);
  var id2 = S2.toId(key2);

  if (loc.key !== key || loc.id !== id) {
    console.error("Error testing " + loc.name + " @ " + loc.lat + ',' + loc.lng);
    console.error("Calculated/Expected:");
    console.error(id, ':', loc.id);
    console.error(key, " : ", loc.key);
    console.error(loc.point.x(), loc.point.y(), loc.point.z());
    console.error(Long.fromString(id, true, 10).toString(2));
    console.error(Long.fromString(loc.id, true, 10).toString(2));

    throw new Error('Test Failed');
  }

  if (loc.key !== key2 || loc.id !== id2) {
    console.error("Error testing " + loc.name + " @ " + loc.lat + ',' + loc.lng);
    console.error("Secondary Key / ID conversion failed: Calculated/Expected:");
    console.error(id2, ':', loc.id);
    console.error(key2, " : ", loc.key);

    throw new Error('Test Failed');
  }
});
