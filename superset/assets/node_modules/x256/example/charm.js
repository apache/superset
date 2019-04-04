var x256 = require('../');
var charm = require('charm')(process.stdout);

var ix = x256(220,40,150);
charm.foreground(ix).write('beep boop');
