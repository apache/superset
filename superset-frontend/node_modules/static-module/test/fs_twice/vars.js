var fs = require('fs');
var a = fs.readFileSync(__dirname + '/robot.html', 'utf8'),
    b = fs.readFileSync(__dirname + '/x.txt', 'utf8');
console.log(a);
console.log(b);
