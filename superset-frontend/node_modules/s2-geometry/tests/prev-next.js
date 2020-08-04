'use strict';

var S2 = require('../src/s2geometry.js').S2;

function getNeighbors(lat, lng, step) {
    //var step = 10;
    var level = 15;
    var origin = S2.latLngToQuadkey(lat, lng, level);
    var walk = [];
    // 10 before and 10 after
    var next = S2.nextKey(origin);
    var prev = S2.prevKey(origin);
    var i;

    for (i = 0; i < step; i++) {
        walk.unshift(S2.toId(prev));
        prev = S2.prevKey(prev);
    }

    walk.push(S2.toId(origin));

    for (i = 0; i < step; i++) {
        // in range(10):
        walk.push(S2.toId(next));
        next = S2.nextKey(next);
    }

    return walk;
}


/*
// Startup Building in Provo
var lat = 40.2262363;
var lng = -111.6630927;

var walk = getNeighbors(lat, lng, 5);

walk.forEach(function (cellId, i) {
  var key = S2.fromId(cellId);
  var face = parseInt(key.substr(0, 1), 10);
  var pos = key.substr(2);
  var level = pos.length;

  // TODO
  // S2.keyToLatLng(key);
  // S2.idToLatLng(id);

  // ! because converting CellId / HilbertQuadkey to LatLng is not implemented... yet
  console.log(-((walk.length - 1) / 2) + i, face, cellId, S2.fromId(cellId), '!', level);
});
*/


// Kyderman's test location
var lat = 51.352085106718384;
var lng = -2.9877930879592896;
var walk = getNeighbors(lat, lng, 5);

walk.forEach(function (cellId, i) {
  var key = S2.fromId(cellId);
  var face = parseInt(key.substr(0, 1), 10);
  var pos = key.substr(2);
  var level = pos.length;

  // TODO
  // S2.keyToLatLng(key);
  // S2.idToLatLng(id);

  // ! because converting CellId / HilbertQuadkey to LatLng is not implemented... yet
  console.log(-((walk.length - 1) / 2) + i, face, cellId, S2.fromId(cellId), '!', level);
});
