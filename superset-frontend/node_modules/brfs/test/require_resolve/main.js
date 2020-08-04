var fs = require('fs');
var path = require('path');
var html = fs.readFileSync(require.resolve('aaa/wow.txt'), 'utf8');
console.log(html);
