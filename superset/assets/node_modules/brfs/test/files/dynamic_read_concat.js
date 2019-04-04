var fs = require('fs');
var path = require('path');
var dynamicallyCreatedFilename = path.join('/files/', 'somefile');
var stuff = fs.readFileSync(__dirname + dynamicallyCreatedFilename + __dirname, 'utf8');
