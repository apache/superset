#!/usr/bin/env node
'use strict';

var m_opts = {
  boolean: ['color', 'help'],
  alias: {
    'color':   'c',
    'c-ratio': 'r',
    'fit':     'f',
    'height':  't',
    'width':   'w',
    'help':    '?'
  }
}

var argv = require('minimist')(process.argv.slice(2), m_opts);

// Output help and quit
if (argv.help || argv.h) {
  console.log('');
  console.log('  Usage: asciify [options] [path]');
  console.log('');
  console.log('  Options:');
  console.log('');
  console.log('    -c, --color      true for color, false for B/W');
  console.log('    -r, --c-ratio    character width-height ratio');
  console.log('    -f, --fit        resize rule: box, height, width, original, none');
  console.log('    -t, --height     height to resize to');
  console.log('    -w, --width      width to resize to');
  console.log('');
  console.log('  See the readme for detailed options and defaults');
  console.log('');
  console.log('  Example:');
  console.log('');
  console.log('    $ asciify lolwut.png -c false');
  console.log('');
  process.exit(0);
}

// Create options for arguments
var options = {
  color:   argv['color'],
  c_ratio: argv['c-ratio'],
  fit:     argv['fit'],
  height:  argv['height'],
  width:   argv['width']
}

var errorOutput = function(message) {
  console.log(message);
  process.exit(1);
}

// Setup defaults just for CLI
if (!options.fit)    options.fit    = 'box';
if (!options.width)  options.width  = '100%';
if (!options.height) options.height = '100%';

if (!argv._[0])      errorOutput('You must provide an image');

// Call the module
require('./index')(argv._[0], options).then(console.log).catch(errorOutput);
