var fs = require('fs');
var src = fs.readFileSync(__dirname + '/x.txt', 'utf8');
console.log(src);
