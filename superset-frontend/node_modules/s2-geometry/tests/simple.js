'use strict';

var S2 = require('../src/s2geometry.js').S2;

var lat = 40.2574448;
var lng = -111.7089464;
var level = 15;



//
// Convert from Lat / Lng
//
var key = S2.latLngToKey(lat, lng, level);
console.log(key);
// '4/032212303102210'



//
// Convert between Hilbert Curve Quadtree Key and S2 Cell Id
//
var id = S2.keyToId(key);
console.log(id);
// '9749618446378729472'

var key = S2.idToKey(id);
console.log(key);
// '9749618446378729472'



//
// Neighbors
//
var neighbors = S2.latLngToNeighborKeys(lat, lng, level);
console.log(neighbors);
// [ keyLeft, keyDown, keyRight, keyUp ]



//
// Previous, Next, and Step
//
var nextKey = S2.nextKey(key);
console.log(nextKey);
var prevKey = S2.prevKey(key);
console.log(prevKey);

var backTenKeys = S2.stepKey(key, -10);
console.log(backTenKeys);
