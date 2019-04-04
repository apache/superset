var through = require('through2');
var equals = require('buffer-equal')
var buffers = {
    quote: Buffer('"'),
    escapeQuote: Buffer('\\"'),
    escapeEscape: Buffer('\\\\'),
    escapeB: Buffer('\\b'),
    escapeF: Buffer('\\f'),
    escapeN: Buffer('\\n'),
    escapeR: Buffer('\\r'),
    escapeT: Buffer('\\t'),
    escapeLineSeparator: Buffer('\\u2028'),
    escapeParagraphSeparator: Buffer('\\u2029')
};

for (var i = 0; i < 32; i++) {
    var s = i.toString(16);
    buffers[i] = Buffer('\\u' + Array(5-s.length).join('0') + s);
}

var codes = {
    quote: '"'.charCodeAt(0),
    escape: '\\'.charCodeAt(0),
    b: '\b'.charCodeAt(0),
    f: '\f'.charCodeAt(0),
    n: '\n'.charCodeAt(0),
    r: '\r'.charCodeAt(0),
    t: '\t'.charCodeAt(0)
};

var multiByteBuffers = {
    lineSeparator: Buffer('\u2028', 'utf8'),
    paragraphSeparator: Buffer('\u2029', 'utf8')
};
var multiByteSeparatorLength = multiByteBuffers.lineSeparator.length; // same for both
var multiByteSeparatorOffset = multiByteSeparatorLength - 1;
var multiByteSeparatorCode = multiByteBuffers.lineSeparator[0]; // same for both

var map = {};
map[codes.quote] = buffers.escapeQuote;
map[codes.escape] = buffers.escapeEscape;
map[codes.b] = buffers.escapeB;
map[codes.f] = buffers.escapeF;
map[codes.n] = buffers.escapeN;
map[codes.r] = buffers.escapeR;
map[codes.t] = buffers.escapeT;

module.exports = function () {
    var stream = through(write, end);
    stream.push(buffers.quote);
    return stream;
    
    function write (buf, enc, next) {
        var offset = 0;
        for (var i = 0; i < buf.length; i++) {
            var c = buf[i];
            var m = map[c];
            if (m) {
                var bufs = [ buf.slice(offset, i), m ];
                this.push(Buffer.concat(bufs));
                offset = i + 1;
            }
            else if (c < 32) {
                var bufs = [ buf.slice(offset, i), buffers[c] ];
                this.push(Buffer.concat(bufs));
                offset = i + 1;
            }
            else if (c === multiByteSeparatorCode) {
                var rawBuf = buf.slice(i, i + multiByteSeparatorLength);
                var escapeBuf = null;
                if (equals(rawBuf, multiByteBuffers.lineSeparator)) {
                  escapeBuf = buffers.escapeLineSeparator;
                } else if (equals(rawBuf, multiByteBuffers.paragraphSeparator)) {
                  escapeBuf = buffers.escapeParagraphSeparator;
                }
                if (escapeBuf) {
                    var bufs = [ buf.slice(offset, i), escapeBuf ];
                    this.push(Buffer.concat(bufs));
                    offset = i + multiByteSeparatorLength;
                    i += multiByteSeparatorOffset
                }
            }
        }
        if (offset === 0) this.push(buf)
        else this.push(buf.slice(offset));
        next();
    }
    function end (next) {
        this.push(buffers.quote);
        this.push(null);
    }
};
