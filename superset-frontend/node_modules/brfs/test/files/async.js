var fs = require('fs');
fs.readFile(__dirname + '/async.txt', 'utf8', function (err, txt) {
    console.log(txt);
});
