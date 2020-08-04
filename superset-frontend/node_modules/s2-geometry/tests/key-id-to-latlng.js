'use strict';

var S2 = require('../src/s2geometry.js').S2;
var x, y;
var count = 0;

function refCheck() {
  var refKey = '4/032212303102210';
  var latlng = {
    'lat': 40.2574448
  , 'lng': -111.7089464
  };

  var key = S2.latLngToKey(latlng.lat, latlng.lng, 15);
  if (key !== refKey) {
    throw new Error("reference doesn't match");
  }

  var latlng1 = S2.keyToLatLng('4/032212303102210');
  var key1 = S2.latLngToKey(latlng1.lat, latlng1.lng, 15);
  if (key1 !== refKey) {
    throw new Error("reference 1 doesn't match");
  }

  var latlng2 = S2.idToLatLng('9749618446378729472');
  var key2 = S2.latLngToKey(latlng2.lat, latlng2.lng, 15);
  if (key2 !== refKey) {
    throw new Error("reference 2 doesn't match");
  }
}

function checkReal(lat, lng) {
  var key = S2.latLngToKey(lat, lng, 15);
  var latlng = S2.keyToLatLng(key);
  var key2 = S2.latLngToKey(latlng.lat, latlng.lng, 15);
  if (key !== key2) {
    throw new Error("keys do not match", latlng, key, key2);
  }
}

for (x = -180; x <= 180; x += (0 + Math.random())) {
  for (y = -180; y <= 180; y += (0 + Math.random())) {
    count += 1;
    checkReal(x, y);
  }
}

console.log('PASS:', count, 'random locations without any key mismatches');
