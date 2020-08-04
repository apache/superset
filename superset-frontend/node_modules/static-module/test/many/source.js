var fs = require('fs');
var a = fs.readFileSync(__dirname + '/a.txt', 'utf8');
var b = fs.readFileSync(__dirname + '/b.txt', 'utf8');
var c = fs.readFileSync(__dirname + '/c.txt', 'utf8');
console.log(a + b + c);
