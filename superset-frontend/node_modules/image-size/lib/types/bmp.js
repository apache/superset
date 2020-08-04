'use strict';

function isBMP (buffer) {
  return ('BM' === buffer.toString('ascii', 0, 2));
}

function calculate (buffer) {
  return {
    'width': buffer.readUInt32LE(18),
    'height': Math.abs(buffer.readInt32LE(22))
  };
}

module.exports = {
  'detect': isBMP,
  'calculate': calculate
};
