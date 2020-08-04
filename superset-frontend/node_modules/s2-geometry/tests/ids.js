'use strict';

var S2 = require('../src/s2geometry').S2;

var cellId = S2.fromFacePosLevel(4, '032212303102210');
var hilbertQuadkey = S2.toHilbertQuadkey('9749618446378729472');

console.log(cellId, '9749618446378729472' === cellId);
console.log(hilbertQuadkey, '4/032212303102210' === hilbertQuadkey);
