require('core-js');
var i = require('./');

console.log(i(new Map([[1, 2]])), i(new Set([[1, 2]])));
