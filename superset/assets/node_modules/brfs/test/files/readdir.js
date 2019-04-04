var fs = require('fs');

fs.readdir(__dirname, function(err, files) {
    if (err) throw err;
    console.log(files);
});
