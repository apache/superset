var fs = require('fs');
var txt = fs.readFileSync(__dirname + '/robot.html', { encoding: 'hex' });

console.log(txt);