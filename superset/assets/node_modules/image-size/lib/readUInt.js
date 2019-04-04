'use strict';

// Abstract reading multi-byte unsigned integers
function readUInt (buffer, bits, offset, isBigEndian) {
  offset = offset || 0;
  var endian = !!isBigEndian ? 'BE' : 'LE';
  var method = buffer['readUInt' + bits + endian];
  return method.call(buffer, offset);
}

module.exports = readUInt;
