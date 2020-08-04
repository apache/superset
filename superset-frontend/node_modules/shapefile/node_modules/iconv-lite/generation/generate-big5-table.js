var http = require('http');
var fs = require('fs');
// BIG5
var cp950_b2u = {host:'moztw.org',path:'/docs/big5/table/cp950-b2u.txt'},
    cp950_u2b = {host:'moztw.org',path:'/docs/big5/table/cp950-u2b.txt'},
    cp950_moz18_b2u = {host:'moztw.org',path:'/docs/big5/table/moz18-b2u.txt'};

http.get(cp950_moz18_b2u, function(res) {
  var data = '';
  res.on('data', function(chunk) {
    data += chunk;
  });
  res.on('end', function() {
    var table = {};
    data = data.split('\n').slice(1);
    data.forEach(function(line, idx) {
      var pair = line.split(' ');
      var key = parseInt(pair[0]);
      var val = parseInt(pair[1]);
      table[key] = val;
    });
    fs.createWriteSync('encodings/table/big5.js',
    	'module.exports = ' + JSON.stringify(table) + ';');
  });
});
