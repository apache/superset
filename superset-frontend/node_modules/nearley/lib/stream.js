// Node-only

var Writable = require('stream').Writable;
var util = require('util');

function StreamWrapper(parser) {
    Writable.call(this);
    this._parser = parser;
}

util.inherits(StreamWrapper, Writable);

StreamWrapper.prototype._write = function write(chunk, encoding, callback) {
    this._parser.feed(chunk.toString());
    callback();
};

module.exports = StreamWrapper;
