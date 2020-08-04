'use strict';

var encoding = require('encoding');
var sharedFuncs = require('./shared');
var Transform = require('stream').Transform;
var util = require('util');

/**
 * Parses a PO object into translation table
 *
 * @param {Buffer|String} buffer PO object
 * @param {String} [defaultCharset] Default charset to use
 * @return {Object} Translation object
 */
module.exports.parse = function(buffer, defaultCharset) {
    var parser = new Parser(buffer, defaultCharset);
    return parser.parse();
};

/**
 * Parses a PO stream, emits translation table in object mode
 *
 * @param {String} [defaultCharset] Default charset to use
 * @param {String} [options] Stream options
 * @return {Stream} Transform stream
 */
module.exports.stream = function(defaultCharset, options) {
    return new PoParserTransform(defaultCharset, options);
};

/**
 * Creates a PO parser object. If PO object is a string,
 * UTF-8 will be used as the charset
 *
 * @constructor
 * @param {Buffer|String} fileContents PO object
 * @param {String} [defaultCharset] Default charset to use
 */
function Parser(fileContents, defaultCharset) {

    this._charset = defaultCharset || 'iso-8859-1';

    this._lex = [];
    this._escaped = false;
    this._node;
    this._state = this.states.none;

    if (typeof fileContents === 'string') {
        this._charset = 'utf-8';
        this._fileContents = fileContents;
    } else {
        this._handleCharset(fileContents);
    }
}

/**
 * Parses the PO object and returns translation table
 *
 * @return {Object} Translation table
 */
Parser.prototype.parse = function() {
    this._lexer(this._fileContents);
    return this._finalize(this._lex);
};

/**
 * Detects charset for PO strings from the header
 *
 * @param {Buffer} headers Header value
 */
Parser.prototype._handleCharset = function(buf) {
    var str = (buf || '').toString(),
        pos, headers = '',
        match;

    if ((pos = str.search(/^\s*msgid/im)) >= 0) {
        if ((pos = pos + str.substr(pos + 5).search(/^\s*(msgid|msgctxt)/im))) {
            headers = str.substr(0, pos);
        }
    }

    if ((match = headers.match(/[; ]charset\s*=\s*([\w\-]+)(?:[\s;]|\\n)*"\s*$/mi))) {
        this._charset = sharedFuncs.formatCharset(match[1], this._charset);
    }

    if (this._charset === 'utf-8') {
        this._fileContents = str;
    } else {
        this._fileContents = this._toString(buf);
    }
};

Parser.prototype._toString = function(buf) {
    return encoding.convert(buf, 'utf-8', this._charset).toString('utf-8');
};

/**
 * State constants for parsing FSM
 */
Parser.prototype.states = {
    none: 0x01,
    comments: 0x02,
    key: 0x03,
    string: 0x04
};

/**
 * Value types for lexer
 */
Parser.prototype.types = {
    comments: 0x01,
    key: 0x02,
    string: 0x03
};

/**
 * String matches for lexer
 */
Parser.prototype.symbols = {
    quotes: /["']/,
    comments: /\#/,
    whitespace: /\s/,
    key: /[\w\-\[\]]/
};

/**
 * Token parser. Parsed state can be found from this._lex
 *
 * @param {String} chunk String
 */
Parser.prototype._lexer = function(chunk) {
    var chr;

    for (var i = 0, len = chunk.length; i < len; i++) {
        chr = chunk.charAt(i);
        switch (this._state) {
            case this.states.none:
                if (chr.match(this.symbols.quotes)) {
                    this._node = {
                        type: this.types.string,
                        value: '',
                        quote: chr
                    };
                    this._lex.push(this._node);
                    this._state = this.states.string;
                } else if (chr.match(this.symbols.comments)) {
                    this._node = {
                        type: this.types.comments,
                        value: ''
                    };
                    this._lex.push(this._node);
                    this._state = this.states.comments;
                } else if (!chr.match(this.symbols.whitespace)) {
                    this._node = {
                        type: this.types.key,
                        value: chr
                    };
                    this._lex.push(this._node);
                    this._state = this.states.key;
                }
                break;
            case this.states.comments:
                if (chr === '\n') {
                    this._state = this.states.none;
                } else if (chr !== '\r') {
                    this._node.value += chr;
                }
                break;
            case this.states.string:
                if (this._escaped) {
                    switch (chr) {
                        case 't':
                            this._node.value += '\t';
                            break;
                        case 'n':
                            this._node.value += '\n';
                            break;
                        case 'r':
                            this._node.value += '\r';
                            break;
                        default:
                            this._node.value += chr;
                    }
                    this._escaped = false;
                } else {
                    if (chr === this._node.quote) {
                        this._state = this.states.none;
                    } else if (chr === '\\') {
                        this._escaped = true;
                        break;
                    } else {
                        this._node.value += chr;
                    }
                    this._escaped = false;
                }
                break;
            case this.states.key:
                if (!chr.match(this.symbols.key)) {
                    this._state = this.states.none;
                    i--;
                } else {
                    this._node.value += chr;
                }
                break;
        }
    }
};

/**
 * Join multi line strings
 *
 * @param {Object} tokens Parsed tokens
 * @return {Object} Parsed tokens, with multi line strings joined into one
 */
Parser.prototype._joinStringValues = function(tokens) {
    var lastNode, response = [];

    for (var i = 0, len = tokens.length; i < len; i++) {
        if (lastNode && tokens[i].type === this.types.string && lastNode.type === this.types.string) {
            lastNode.value += tokens[i].value;
        } else if (lastNode && tokens[i].type === this.types.comments && lastNode.type === this.types.comments) {
            lastNode.value += '\n' + tokens[i].value;
        } else {
            response.push(tokens[i]);
            lastNode = tokens[i];
        }
    }

    return response;
};

/**
 * Parse comments into separate comment blocks
 *
 * @param {Object} tokens Parsed tokens
 */
Parser.prototype._parseComments = function(tokens) {
    // parse comments
    tokens.forEach((function(node) {
        var comment, lines;

        if (node && node.type === this.types.comments) {
            comment = {
                translator: [],
                extracted: [],
                reference: [],
                flag: [],
                previous: []
            };
            lines = (node.value || '').split(/\n/);
            lines.forEach(function(line) {
                switch (line.charAt(0) || '') {
                    case ':':
                        comment.reference.push(line.substr(1).trim());
                        break;
                    case '.':
                        comment.extracted.push(line.substr(1).replace(/^\s+/, ''));
                        break;
                    case ',':
                        comment.flag.push(line.substr(1).replace(/^\s+/, ''));
                        break;
                    case '|':
                        comment.previous.push(line.substr(1).replace(/^\s+/, ''));
                        break;
                    default:
                        comment.translator.push(line.replace(/^\s+/, ''));
                }
            });

            node.value = {};

            Object.keys(comment).forEach(function(key) {
                if (comment[key] && comment[key].length) {
                    node.value[key] = comment[key].join('\n');
                }
            });
        }
    }).bind(this));
};

/**
 * Join gettext keys with values
 *
 * @param {Object} tokens Parsed tokens
 * @return {Object} Tokens
 */
Parser.prototype._handleKeys = function(tokens) {
    var response = [],
        lastNode;

    for (var i = 0, len = tokens.length; i < len; i++) {
        if (tokens[i].type === this.types.key) {
            lastNode = {
                key: tokens[i].value
            };
            if (i && tokens[i - 1].type === this.types.comments) {
                lastNode.comments = tokens[i - 1].value;
            }
            lastNode.value = '';
            response.push(lastNode);
        } else if (tokens[i].type === this.types.string && lastNode) {
            lastNode.value += tokens[i].value;
        }
    }

    return response;
};

/**
 * Separate different values into individual translation objects
 *
 * @param {Object} tokens Parsed tokens
 * @return {Object} Tokens
 */
Parser.prototype._handleValues = function(tokens) {
    var response = [],
        lastNode, curContext, curComments;

    for (var i = 0, len = tokens.length; i < len; i++) {
        if (tokens[i].key.toLowerCase() === 'msgctxt') {
            curContext = tokens[i].value;
            curComments = tokens[i].comments;
        } else if (tokens[i].key.toLowerCase() === 'msgid') {
            lastNode = {
                msgid: tokens[i].value
            };

            if (curContext) {
                lastNode.msgctxt = curContext;
            }

            if (curComments) {
                lastNode.comments = curComments;
            }

            if (tokens[i].comments && !lastNode.comments) {
                lastNode.comments = tokens[i].comments;
            }

            curContext = false;
            curComments = false;
            response.push(lastNode);
        } else if (tokens[i].key.toLowerCase() === 'msgid_plural') {
            if (lastNode) {
                lastNode.msgid_plural = tokens[i].value;
            }

            if (tokens[i].comments && !lastNode.comments) {
                lastNode.comments = tokens[i].comments;
            }

            curContext = false;
            curComments = false;
        } else if (tokens[i].key.substr(0, 6).toLowerCase() === 'msgstr') {
            if (lastNode) {
                lastNode.msgstr = (lastNode.msgstr || []).concat(tokens[i].value);
            }

            if (tokens[i].comments && !lastNode.comments) {
                lastNode.comments = tokens[i].comments;
            }

            curContext = false;
            curComments = false;
        }
    }

    return response;
};

/**
 * Compose a translation table from tokens object
 *
 * @param {Object} tokens Parsed tokens
 * @return {Object} Translation table
 */
Parser.prototype._normalize = function(tokens) {
    var msgctxt,
        table = {
            charset: this._charset,
            headers: undefined,
            translations: {}
        };

    for (var i = 0, len = tokens.length; i < len; i++) {
        msgctxt = tokens[i].msgctxt || '';

        if (!table.translations[msgctxt]) {
            table.translations[msgctxt] = {};
        }

        if (!table.headers && !msgctxt && !tokens[i].msgid) {
            table.headers = sharedFuncs.parseHeader(tokens[i].msgstr[0]);
        }

        table.translations[msgctxt][tokens[i].msgid] = tokens[i];
    }

    return table;
};

/**
 * Converts parsed tokens to a translation table
 *
 * @param {Object} tokens Parsed tokens
 * @returns {Object} Translation table
 */
Parser.prototype._finalize = function(tokens) {
    var data = this._joinStringValues(tokens);
    this._parseComments(data);
    data = this._handleKeys(data);
    data = this._handleValues(data);

    return this._normalize(data);
};

/**
 * Creates a transform stream for parsing PO input
 *
 * @constructor
 * @param {String} [defaultCharset] Default charset to use
 * @param {String} [options] Stream options
 */
function PoParserTransform(defaultCharset, options) {
    if (!options && defaultCharset && typeof defaultCharset === 'object') {
        options = defaultCharset;
        defaultCharset = undefined;
    }

    this.defaultCharset = defaultCharset;
    this._parser = false;
    this._tokens = {};

    this._cache = [];
    this._cacheSize = 0;

    this.initialTreshold = options.initialTreshold || 2 * 1024;

    Transform.call(this, options);
    this._writableState.objectMode = false;
    this._readableState.objectMode = true;
}
util.inherits(PoParserTransform, Transform);

/**
 * Processes a chunk of the input stream
 */
PoParserTransform.prototype._transform = function(chunk, encoding, done) {
    var i, len = 0;

    if (!chunk || !chunk.length) {
        return done();
    }

    if (!this._parser) {
        this._cache.push(chunk);
        this._cacheSize += chunk.length;

        // wait until the first 1kb before parsing headers for charset
        if (this._cacheSize < this.initialTreshold) {
            return setImmediate(done);
        } else if (this._cacheSize) {
            chunk = Buffer.concat(this._cache, this._cacheSize);
            this._cacheSize = 0;
            this._cache = [];
        }

        this._parser = new Parser(chunk, this.defaultCharset);
    } else if (this._cacheSize) {
        // this only happens if we had an uncompleted 8bit sequence from the last iteration
        this._cache.push(chunk);
        this._cacheSize += chunk.length;
        chunk = Buffer.concat(this._cache, this._cacheSize);
        this._cacheSize = 0;
        this._cache = [];
    }

    // cache 8bit bytes from the end of the chunk
    // helps if the chunk ends in the middle of an utf-8 sequence
    for (i = chunk.length - 1; i >= 0; i--) {
        if (chunk[i] >= 0x80) {
            len++;
            continue;
        }
        break;
    }
    // it seems we found some 8bit bytes from the end of the string, so let's cache these
    if (len) {
        this._cache = [chunk.slice(chunk.length - len)];
        this._cacheSize = this._cache[0].length;
        chunk = chunk.slice(0, chunk.length - len);
    }

    // chunk might be empty if it only contined of 8bit bytes and these were all cached
    if (chunk.length) {
        this._parser._lexer(this._parser._toString(chunk));
    }

    setImmediate(done);
};

/**
 * Once all input has been processed emit the parsed translation table as an object
 */
PoParserTransform.prototype._flush = function(done) {
    var chunk;

    if (this._cacheSize) {
        chunk = Buffer.concat(this._cache, this._cacheSize);
    }

    if (!this._parser && chunk) {
        this._parser = new Parser(chunk, this.defaultCharset);
    }

    if (chunk) {
        this._parser._lexer(this._parser._toString(chunk));
    }

    if (this._parser) {
        this.push(this._parser._finalize(this._parser._lex));
    }

    setImmediate(done);
};