var fs = require('fs');
var xxx = require('path');
var html = fs.readFileSync(xxx.join(__dirname, 'robot.html'), 'utf8');
console.log(html);
