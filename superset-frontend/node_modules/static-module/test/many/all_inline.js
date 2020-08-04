var fs = require('fs'),
    a = fs.readFileSync(__dirname + '/a.txt', 'utf8'),
    b = fs.readFileSync(__dirname + '/b.txt', 'utf8'),
    c = fs.readFileSync(__dirname + '/c.txt', 'utf8')
;
console.log(a + b + c);
