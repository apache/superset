var fs = require('fs'), x = 5;
var src = fs.readFileSync(__dirname + '/x.txt', 'utf8');
console.log(src);
