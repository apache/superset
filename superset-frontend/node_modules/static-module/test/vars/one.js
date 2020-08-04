var fs = require('fs'),
  html = fs.readFileSync(__dirname + '/vars.html', 'utf8')
;
console.log(html);
