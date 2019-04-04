var fs = require('fs');
var path = require('path');
var html = fs.readFileSync(path.join(__dirname, 'vars.html'), 'utf8');
var x = '!';
console.log(html + x);
