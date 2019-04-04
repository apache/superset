'use strict';

var encoding = require('encoding');
var sharedFuncs = require('./shared');

/**
 * Exposes general compiler function. Takes a translation
 * object as a parameter and returns binary MO object
 *
 * @param {Object} table Translation object
 * @return {Buffer} Compiled binary MO object
 */
module.exports = function(table) {
    var compiler = new Compiler(table);
    return compiler.compile();
};

/**
 * Creates a MO compiler object.
 *
 * @constructor
 * @param {Object} table Translation table as defined in the README
 */
function Compiler(table) {
    this._table = table || {};
    this._table.headers = this._table.headers || {};
    this._table.translations = this._table.translations || {};

    this._translations = [];

    this._writeFunc = 'writeUInt32LE';

    this._handleCharset();
}

/**
 * Magic bytes for the generated binary data
 */
Compiler.prototype.MAGIC = 0x950412de;

/**
 * Handles header values, replaces or adds (if needed) a charset property
 */
Compiler.prototype._handleCharset = function() {
    var parts = (this._table.headers['content-type'] || 'text/plain').split(';'),
        contentType = parts.shift(),
        charset = sharedFuncs.formatCharset(this._table.charset),
        params = [];

    params = parts.map(function(part) {
        var parts = part.split('='),
            key = parts.shift().trim(),
            value = parts.join('=');

        if (key.toLowerCase() === 'charset') {
            if (!charset) {
                charset = sharedFuncs.formatCharset(value.trim() || 'utf-8');
            }
            return 'charset=' + charset;
        }

        return part;
    });

    if (!charset) {
        charset = this._table.charset || 'utf-8';
        params.push('charset=' + charset);
    }

    this._table.charset = charset;
    this._table.headers['content-type'] = contentType + '; ' + params.join('; ');

    this._charset = charset;
};

/**
 * Generates an array of translation strings
 * in the form of [{msgid:... , msgstr:...}]
 *
 * @return {Array} Translation strings array
 */
Compiler.prototype._generateList = function() {
    var list = [];

    list.push({
        msgid: new Buffer(0),
        msgstr: encoding.convert(sharedFuncs.generateHeader(this._table.headers), this._charset)
    });

    Object.keys(this._table.translations).forEach((function(msgctxt) {
        if (typeof this._table.translations[msgctxt] !== 'object') {
            return;
        }
        Object.keys(this._table.translations[msgctxt]).forEach((function(msgid) {
            if (typeof this._table.translations[msgctxt][msgid] !== 'object') {
                return;
            }
            if (msgctxt === '' && msgid === '') {
                return;
            }

            var msgid_plural = this._table.translations[msgctxt][msgid].msgid_plural,
                key = msgid,
                value;

            if (msgctxt) {
                key = msgctxt + '\u0004' + key;
            }

            if (msgid_plural) {
                key += '\u0000' + msgid_plural;
            }

            value = [].concat(this._table.translations[msgctxt][msgid].msgstr || []).join('\u0000');

            list.push({
                msgid: encoding.convert(key, this._charset),
                msgstr: encoding.convert(value, this._charset)
            });
        }).bind(this));
    }).bind(this));

    return list;
};

/**
 * Calculate buffer size for the final binary object
 *
 * @param {Array} list An array of translation strings from _generateList
 * @return {Object} Size data of {msgid, msgstr, total}
 */
Compiler.prototype._calculateSize = function(list) {
    var msgidLength = 0,
        msgstrLength = 0,
        totalLength = 0;

    list.forEach(function(translation) {
        msgidLength += translation.msgid.length + 1; // + extra 0x00
        msgstrLength += translation.msgstr.length + 1; // + extra 0x00
    });

    totalLength = 4 + // magic number
        4 + // revision
        4 + // string count
        4 + // original string table offset
        4 + // translation string table offset
        4 + // hash table size
        4 + // hash table offset
        (4 + 4) * list.length + // original string table
        (4 + 4) * list.length + // translations string table
        msgidLength + // originals
        msgstrLength; // translations

    return {
        msgid: msgidLength,
        msgstr: msgstrLength,
        total: totalLength
    };
};

/**
 * Generates the binary MO object from the translation list
 *
 * @param {Array} list translation list
 * @param {Object} size Byte size information
 * @return {Buffer} Compiled MO object
 */
Compiler.prototype._build = function(list, size) {
    var returnBuffer = new Buffer(size.total),
        curPosition = 0,
        i, len;

    // magic
    returnBuffer[this._writeFunc](this.MAGIC, 0);

    // revision
    returnBuffer[this._writeFunc](0, 4);

    // string count
    returnBuffer[this._writeFunc](list.length, 8);

    // original string table offset
    returnBuffer[this._writeFunc](28, 12);

    // translation string table offset
    returnBuffer[this._writeFunc](28 + (4 + 4) * list.length, 16);

    // hash table size
    returnBuffer[this._writeFunc](0, 20);

    // hash table offset
    returnBuffer[this._writeFunc](28 + (4 + 4) * list.length, 24);

    // build originals table
    curPosition = 28 + 2 * (4 + 4) * list.length;
    for (i = 0, len = list.length; i < len; i++) {
        list[i].msgid.copy(returnBuffer, curPosition);
        returnBuffer[this._writeFunc](list[i].msgid.length, 28 + i * 8);
        returnBuffer[this._writeFunc](curPosition, 28 + i * 8 + 4);
        returnBuffer[curPosition + list[i].msgid.length] = 0x00;
        curPosition += list[i].msgid.length + 1;
    }

    // build translations table
    for (i = 0, len = list.length; i < len; i++) {
        list[i].msgstr.copy(returnBuffer, curPosition);
        returnBuffer[this._writeFunc](list[i].msgstr.length, 28 + (4 + 4) * list.length + i * 8);
        returnBuffer[this._writeFunc](curPosition, 28 + (4 + 4) * list.length + i * 8 + 4);
        returnBuffer[curPosition + list[i].msgstr.length] = 0x00;
        curPosition += list[i].msgstr.length + 1;
    }

    return returnBuffer;
};

/**
 * Compiles translation object into a binary MO object
 *
 * @return {Buffer} Compiled MO object
 */
Compiler.prototype.compile = function() {
    var list = this._generateList(),
        size = this._calculateSize(list);

    // sort by msgid
    list.sort(function(a, b) {
        if (a.msgid > b.msgid) {
            return 1;
        }
        if (a.msgid < b.msgid) {
            return -1;
        }
        return 0;
    });

    return this._build(list, size);
};