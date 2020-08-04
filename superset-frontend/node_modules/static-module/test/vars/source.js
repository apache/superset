var fs = require('fs'),
  html = fs.readFileSync(__dirname + '/vars.html', 'utf8'),
  x = '!'
;
console.log(html + x);
