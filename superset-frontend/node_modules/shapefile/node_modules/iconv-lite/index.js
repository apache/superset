var RE_SPACEDASH = /[- ]/g;
// Module exports
var iconv = module.exports = {
    toEncoding: function(str, encoding) {
        return iconv.getCodec(encoding).toEncoding(str);
    },
    fromEncoding: function(buf, encoding) {
        return iconv.getCodec(encoding).fromEncoding(buf);
    },
    encodingExists: function(enc) {
        loadEncodings();
        enc = enc.replace(RE_SPACEDASH, "").toLowerCase();
        return (iconv.encodings[enc] !== undefined);
    },
    
    defaultCharUnicode: '�',
    defaultCharSingleByte: '?',

    encodingsLoaded: false,
    
    // Get correct codec for given encoding.
    getCodec: function(encoding) {
        loadEncodings();
        var enc = encoding || "utf8";
        var codecOptions = undefined;
        while (1) {
            if (getType(enc) === "String")
                enc = enc.replace(RE_SPACEDASH, "").toLowerCase();
            var codec = iconv.encodings[enc];
            var type = getType(codec);
            if (type === "String") {
                // Link to other encoding.
                codecOptions = {originalEncoding: enc};
                enc = codec;
            }
            else if (type === "Object" && codec.type != undefined) {
                // Options for other encoding.
                codecOptions = codec;
                enc = codec.type;
            } 
            else if (type === "Function")
                // Codec itself.
                return codec(codecOptions);
            else
                throw new Error("Encoding not recognized: '" + encoding + "' (searched as: '"+enc+"')");
        }
    },
    
    // Define basic encodings
    encodings: {
        internal: function(options) {
            return {
                toEncoding: toInternalEncoding,
                fromEncoding: fromInternalEncoding,
                options: options
            };
        },
        utf8: "internal",
        ucs2: "internal",
        binary: "internal",
        ascii: "internal",
        base64: "internal",
        
        // Codepage single-byte encodings.
        singlebyte: function(options) {
            // Prepare chars if needed
            if (!options.charsBuf) {
                if (!options.chars || (options.chars.length !== 128 && options.chars.length !== 256))
                    throw new Error("Encoding '"+options.type+"' has incorrect 'chars' (must be of len 128 or 256)");
                
                if (options.chars.length === 128)
                    options.chars = asciiString + options.chars;

                options.charsBuf = new Buffer(options.chars, 'ucs2');
            }
            
            if (!options.revCharsBuf) {
                options.revCharsBuf = new Buffer(65536);
                var defChar = iconv.defaultCharSingleByte.charCodeAt(0);
                for (var i = 0; i < options.revCharsBuf.length; i++)
                    options.revCharsBuf[i] = defChar;
                for (var i = 0; i < options.chars.length; i++)
                    options.revCharsBuf[options.chars.charCodeAt(i)] = i;
            }

            return {
                toEncoding: toSingleByteEncoding,
                fromEncoding: fromSingleByteEncoding,
                options: options,
            };
        },

        // Codepage double-byte encodings.
        table: function(options) {
            if (!options.table) {
                throw new Error("Encoding '" + options.type + "' has incorect 'table' option");
            }
            if (!options.revCharsTable) {
                var revCharsTable = options.revCharsTable = {};
                for (var i = 0; i <= 0xFFFF; i++) {
                    revCharsTable[i] = 0;
                }

                var table = options.table;
                for (var key in table) {
                    revCharsTable[table[key]] = +key;
                }
            }
            
            return {
                toEncoding: toTableEncoding,
                fromEncoding: fromTableEncoding,
                options: options,
            };
        }
    }
};

function toInternalEncoding(str) {
    return new Buffer(ensureString(str), this.options.originalEncoding);
}

function fromInternalEncoding(buf) {
    return ensureBuffer(buf).toString(this.options.originalEncoding);
}

function toTableEncoding(str) {
    str = ensureString(str);
    var strLen = str.length;
    var revCharsTable = this.options.revCharsTable;
    var newBuf = new Buffer(strLen*2), gbkcode, unicode,
        defaultChar = revCharsTable[iconv.defaultCharUnicode.charCodeAt(0)];

    for (var i = 0, j = 0; i < strLen; i++) {
        unicode = str.charCodeAt(i);
        if (unicode >> 7) {
            gbkcode = revCharsTable[unicode] || defaultChar;
            newBuf[j++] = gbkcode >> 8; //high byte;
            newBuf[j++] = gbkcode & 0xFF; //low byte
        } else {//ascii
            newBuf[j++] = unicode;
        }
    }
    return newBuf.slice(0, j);
}

function fromTableEncoding(buf) {
    buf = ensureBuffer(buf);
    var bufLen = buf.length;
    var table = this.options.table;
    var newBuf = new Buffer(bufLen*2), unicode, gbkcode,
        defaultChar = iconv.defaultCharUnicode.charCodeAt(0);

    for (var i = 0, j = 0; i < bufLen; i++, j+=2) {
        gbkcode = buf[i];
        if (gbkcode & 0x80) {
            gbkcode = (gbkcode << 8) + buf[++i];
            unicode = table[gbkcode] || defaultChar;
        } else {
            unicode = gbkcode;
        }
        newBuf[j] = unicode & 0xFF; //low byte
        newBuf[j+1] = unicode >> 8; //high byte
    }
    return newBuf.slice(0, j).toString('ucs2');
}

function toSingleByteEncoding(str) {
    str = ensureString(str);
    
    var buf = new Buffer(str.length);
    var revCharsBuf = this.options.revCharsBuf;
    for (var i = 0; i < str.length; i++)
        buf[i] = revCharsBuf[str.charCodeAt(i)];
    
    return buf;
}

function fromSingleByteEncoding(buf) {
    buf = ensureBuffer(buf);
    
    // Strings are immutable in JS -> we use ucs2 buffer to speed up computations.
    var charsBuf = this.options.charsBuf;
    var newBuf = new Buffer(buf.length*2);
    var idx1 = 0, idx2 = 0;
    for (var i = 0, _len = buf.length; i < _len; i++) {
        idx1 = buf[i]*2; idx2 = i*2;
        newBuf[idx2] = charsBuf[idx1];
        newBuf[idx2+1] = charsBuf[idx1+1];
    }
    return newBuf.toString('ucs2');
}

// Add aliases to convert functions
iconv.encode = iconv.toEncoding;
iconv.decode = iconv.fromEncoding;

// Load other encodings manually from files in /encodings dir.
function loadEncodings() {
    if (!iconv.encodingsLoaded) {
        [ require('./encodings/singlebyte'),
          require('./encodings/gbk'),
          require('./encodings/big5')
        ].forEach(function(encodings) {
            for (var key in encodings)
                iconv.encodings[key] = encodings[key]
        });
        iconv.encodingsLoaded = true;
    }
}



// Utilities
var asciiString = '\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\x0c\r\x0e\x0f\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1a\x1b\x1c\x1d\x1e\x1f'+
              ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~\x7f';

var ensureBuffer = function(buf) {
    buf = buf || new Buffer(0);
    return (buf instanceof Buffer) ? buf : new Buffer(""+buf, "binary");
}

var ensureString = function(str) {
    str = str || "";
    return (str instanceof Buffer) ? str.toString('utf8') : (""+str);
}

var getType = function(obj) {
    return Object.prototype.toString.call(obj).slice(8, -1);
}

