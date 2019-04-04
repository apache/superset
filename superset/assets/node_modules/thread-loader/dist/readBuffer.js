'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = readBuffer;
function readBuffer(pipe, length, callback) {
  if (length === 0) {
    callback(null, new Buffer(0));
    return;
  }
  var remainingLength = length;
  var buffers = [];
  var readChunk = function readChunk() {
    var onChunk = function onChunk(arg) {
      var chunk = arg;
      var overflow = void 0;
      if (chunk.length > remainingLength) {
        overflow = chunk.slice(remainingLength);
        chunk = chunk.slice(0, remainingLength);
        remainingLength = 0;
      } else {
        remainingLength -= chunk.length;
      }
      buffers.push(chunk);
      if (remainingLength === 0) {
        pipe.pause();
        pipe.removeListener('data', onChunk);
        if (overflow) {
          pipe.unshift(overflow);
        }
        callback(null, Buffer.concat(buffers, length));
      }
    };
    pipe.on('data', onChunk);
    pipe.resume();
  };
  readChunk();
}