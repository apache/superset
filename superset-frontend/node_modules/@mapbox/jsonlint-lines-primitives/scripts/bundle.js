var fs = require('fs');

var source = "var jsonlint = (function(){var require=true,module=false;var exports={};" +
  fs.readFileSync(__dirname+'/../lib/jsonlint.js', 'utf8') +
  "return exports;})()";

console.log(source);

