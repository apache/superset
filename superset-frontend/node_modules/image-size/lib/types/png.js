'use strict';

var pngSignature = 'PNG\r\n\x1a\n';
var pngImageHeaderChunkName = 'IHDR';
var pngFriedChunkName = 'CgBI'; // Used to detect "fried" png's: http://www.jongware.com/pngdefry.html

function isPNG (buffer) {
  if (pngSignature === buffer.toString('ascii', 1, 8)) {
    var chunkName = buffer.toString('ascii', 12, 16);
    if (chunkName === pngFriedChunkName) {
      chunkName = buffer.toString('ascii', 28, 32);
    }
    if (chunkName !== pngImageHeaderChunkName) {
      throw new TypeError('invalid png');
    }
    return true;
  }
}

function calculate (buffer) {
  if (buffer.toString('ascii', 12, 16) === pngFriedChunkName) {
    return {
      'width': buffer.readUInt32BE(32),
      'height': buffer.readUInt32BE(36)
    };
  }
  return {
    'width': buffer.readUInt32BE(16),
    'height': buffer.readUInt32BE(20)
  };
}

module.exports = {
  'detect': isPNG,
  'calculate': calculate
};
