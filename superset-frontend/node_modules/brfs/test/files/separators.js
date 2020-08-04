var fs = require('fs');
var text = fs.readFileSync(__dirname + '/separators.txt', 'utf8');
console.log(text);
