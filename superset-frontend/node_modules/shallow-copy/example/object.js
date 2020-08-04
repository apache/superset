var copy = require('../');

var obj = { a: 3, b: 4, c: [5,6] };
var dup = copy(obj);
dup.b *= 111;
dup.c.push(7);

console.log('original: ', obj);
console.log('copy: ', dup);
