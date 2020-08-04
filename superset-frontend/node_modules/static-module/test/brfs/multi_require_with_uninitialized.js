var fs = require('fs'), x;
var src = fs.readFileSync(__dirname + '/x.txt', 'utf8');
console.log(src);
