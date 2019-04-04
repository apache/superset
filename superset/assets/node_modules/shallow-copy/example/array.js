var copy = require('../');

var xs = [ 3, 4, 5, { f: 6, g: 7 } ];
var dup = copy(xs);
dup.unshift(1, 2);
dup[5].g += 100;

console.log('original: ', xs);
console.log('copy: ', dup);
