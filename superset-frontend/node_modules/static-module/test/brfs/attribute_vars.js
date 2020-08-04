var x = 5, f = require('fs').readFileSync, y = 2;
var src = f(__dirname + '/x.txt', 'utf8');
console.log(src);
