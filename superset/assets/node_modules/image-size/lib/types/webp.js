'use strict';

// based on https://developers.google.com/speed/webp/docs/riff_container

function isWebP (buffer) {
  var riffHeader = 'RIFF' === buffer.toString('ascii', 0, 4);
  var webpHeader = 'WEBP' === buffer.toString('ascii', 8, 12);
  var vp8Header  = 'VP8'  === buffer.toString('ascii', 12, 15);
  return (riffHeader && webpHeader && vp8Header);
}

function calculate (buffer) {
  var chunkHeader = buffer.toString('ascii', 12, 16);
  buffer = buffer.slice(20, 30);

  // Extended webp stream signature
  if (chunkHeader === 'VP8X') {
    var extendedHeader = buffer[0];
    var validStart = (extendedHeader & 0xc0) === 0;
    var validEnd = (extendedHeader & 0x01) === 0;
    if (validStart && validEnd) {
      return calculateExtended(buffer);
    } else {
      return false;
    }
  }

  // Lossless webp stream signature
  if (chunkHeader === 'VP8 ' && buffer[0] !== 0x2f) {
    return calculateLossy(buffer);
  }

  // Lossy webp stream signature
  var signature = buffer.toString('hex', 3, 6);
  if (chunkHeader === 'VP8L' && signature !== '9d012a') {
    return calculateLossless(buffer);
  }

  return false;
}

function calculateExtended (buffer) {
  return {
    'width': 1 + buffer.readUIntLE(4, 3),
    'height': 1 + buffer.readUIntLE(7, 3)
  }
}

function calculateLossless (buffer) {
  return {
    'width': 1 + (((buffer[2] & 0x3F) << 8) | buffer[1]),
    'height': 1 + (((buffer[4] & 0xF) << 10) | (buffer[3] << 2) |
                  ((buffer[2] & 0xC0) >> 6))
  };
}

function calculateLossy (buffer) {
  // `& 0x3fff` returns the last 14 bits
  // TO-DO: include webp scaling in the calculations
  return {
    'width': buffer.readInt16LE(6) & 0x3fff,
    'height': buffer.readInt16LE(8) & 0x3fff
  };
}

module.exports = {
  'detect': isWebP,
  'calculate': calculate
};
