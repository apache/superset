var blarg = require('fs');
var html = blarg.readFileSync(__dirname + '/robot.html', 'utf8');
console.log(html);
