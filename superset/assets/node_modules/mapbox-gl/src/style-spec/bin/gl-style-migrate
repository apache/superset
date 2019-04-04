#!/usr/bin/env node


var fs = require('fs'),
    argv = require('minimist')(process.argv.slice(2)),
    format = require('../').format,
    migrate = require('../').migrate;

console.log(format(migrate(JSON.parse(fs.readFileSync(argv._[0])))));
