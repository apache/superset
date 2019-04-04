var fs = require('fs'),
    tls = require('tls'),
    zlib = require('zlib'),
    Socket = require('net').Socket,
    EventEmitter = require('events').EventEmitter,
    inherits = require('util').inherits,
    inspect = require('util').inspect;

var foo = require('foo');
var bar = require('bar');

var html = fs.readFileSync(__dirname + '/vars.html', 'utf8');

console.log(html);
