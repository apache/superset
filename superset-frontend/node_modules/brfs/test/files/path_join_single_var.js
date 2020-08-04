var fs = require('fs');
var join = require('path').join;
var html = fs.readFileSync(join(__dirname, 'robot.html'), 'utf8');
console.log(html);
