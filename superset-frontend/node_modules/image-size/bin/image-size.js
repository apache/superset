#!/usr/bin/env node
'use strict';

var fs = require('fs');
var path = require('path');

var imageSize = require('..');

var files = process.argv.slice(2);

if (!files.length) {
  console.error('Usage: image-size image1 [image2] [image3] ...');
  process.exit(-1);
}

var red = ['\x1B[31m', '\x1B[39m'];
// var bold = ['\x1B[1m',  '\x1B[22m'];
var grey = ['\x1B[90m', '\x1B[39m'];
var green = ['\x1B[32m', '\x1B[39m'];

files.forEach(function (image) {
  try {
    if (fs.existsSync(path.resolve(image))) {
      var size = imageSize(image);
      var label = green[0] + size.width + green[1] +
                  grey[0] + 'x' + grey[1] +
                  green[0] + size.height + green[1];
      console.info(label, '-', grey[0] + image + grey[1]);
    } else {
      console.error('file doesn\'t exist - ', image);
    }
  } catch (e) {
    // console.error(e.stack);
    console.error(red[0] + e.message + red[1], '-', image);
  }
});
