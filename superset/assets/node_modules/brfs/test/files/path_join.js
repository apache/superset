var fs = require('fs');
var path = require('path');
var html = fs.readFileSync(path.join(__dirname, 'robot.html'), 'utf8');
console.log(html);
