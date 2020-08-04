#!/usr/bin/env node


var fs = require('fs'),
    argv = require('minimist')(process.argv.slice(2)),
    format = require('../').format,
    composite = require('../').composite;

console.log(format(composite(JSON.parse(fs.readFileSync(argv._[0])))));
