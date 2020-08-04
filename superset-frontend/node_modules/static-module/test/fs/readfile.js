var fs = require('fs')
fs.readFile(__dirname + '/x.txt', function (err, src) {
    console.log(src);
});
