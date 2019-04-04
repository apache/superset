var fs = require('fs');
fs.readFile(__dirname + '/robot.html', 'utf8', function (err, html) {
    console.log(html);
});
