var fs = require('fs');
fs.readFile(__dirname + '/async.txt', 'hex', function (err, txt) {
    console.log(txt);
});
