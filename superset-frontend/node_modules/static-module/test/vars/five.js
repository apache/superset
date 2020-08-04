var a = 1, fs = require('fs'),
  b = 2,
  html = fs.readFileSync(__dirname + '/vars.html', 'utf8'),
  c = 3
;
console.log(html + a + b + c);
