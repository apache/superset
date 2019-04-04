var fs = require('fs');
fs.readFile(__dirname + '/async.txt', { encoding: 'hex' }, function (err, txt) {
    console.log(txt);
});
