var f = require('fs').readFileSync;
var src = f(__dirname + '/x.txt', 'utf8');
console.log(src);
