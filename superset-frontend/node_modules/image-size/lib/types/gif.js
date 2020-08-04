'use strict';

var gifRegexp = /^GIF8[79]a/;
function isGIF (buffer) {
  var signature = buffer.toString('ascii', 0, 6);
  return (gifRegexp.test(signature));
}

function calculate(buffer) {
  return {
    'width': buffer.readUInt16LE(6),
    'height': buffer.readUInt16LE(8)
  };
}

module.exports = {
  'detect': isGIF,
  'calculate': calculate
};
