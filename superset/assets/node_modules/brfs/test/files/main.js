var fs = require('fs');
var html = fs.readFileSync(__dirname + '/robot.html', 'utf8');
console.log(html);
