#!/usr/bin/env node
var fs = require('fs');
var path = require('path');
var brfs = require('../');
var file = process.argv[2];

if (file === '-h' || file === '--help') {
    return fs.createReadStream(path.join(__dirname, 'usage.txt'))
        .pipe(process.stdout)
    ;
}

var fromFile = file && file !== '-';
var rs = fromFile
    ? fs.createReadStream(file)
    : process.stdin
;

var fpath = fromFile ? file : path.join(process.cwd(), '-');
rs.pipe(brfs(fpath)).pipe(process.stdout);
