'use strict';

var encoding = require('encoding');
var sharedFuncs = require('./shared');

/**
 * Parses a binary MO object into translation table
 *
 * @param {Buffer} buffer Binary MO object
 * @param {String} [defaultCharset] Default charset to use
 * @return {Object} Translation object
 */
module.exports = function(buffer, defaultCharset) {
    var parser = new Parser(buffer, defaultCharset);
    return parser.parse();
};

/**
 * Creates a MO parser object.
 *
 * @constructor
 * @param {Buffer} fileContents Binary MO object
 * @param {String} [defaultCharset] Default charset to use
 */
function Parser(fileContents, defaultCharset) {

    this._fileContents = fileContents;

    /**
     * Method name for writing int32 values, default littleendian
     */
    this._writeFunc = 'writeUInt32LE';

    /**
     * Method name for reading int32 values, default littleendian
     */
    this._readFunc = 'readUInt32LE';

    this._charset = defaultCharset || 'iso-8859-1';

    this._table = {
        charset: this._charset,
        headers: undefined,
        translations: {}
    };
}

/**
 * Magic constant to check the endianness of the input file
 */
Parser.prototype.MAGIC = 0x950412de;

/**
 * Checks if number values in the input file are in big- or littleendian format.
 *
 * @return {Boolean} Return true if magic was detected
 */
Parser.prototype._checkMagick = function() {
    if (this._fileContents.readUInt32LE(0) === this.MAGIC) {
        this._readFunc = 'readUInt32LE';
        this._writeFunc = 'writeUInt32LE';
        return true;
    } else if (this._fileContents.readUInt32BE(0) === this.MAGIC) {
        this._readFunc = 'readUInt32BE';
        this._writeFunc = 'writeUInt32BE';
        return true;
    } else {
        return false;
    }
};

/**
 * Read the original strings and translations from the input MO file. Use the
 * first translation string in the file as the header.
 */
Parser.prototype._loadTranslationTable = function() {
    var offsetOriginals = this._offsetOriginals,
        offsetTranslations = this._offsetTranslations,
        position, length,
        msgid, msgstr;

    for (var i = 0; i < this._total; i++) {
        // msgid string
        length = this._fileContents[this._readFunc](offsetOriginals);
        offsetOriginals += 4;
        position = this._fileContents[this._readFunc](offsetOriginals);
        offsetOriginals += 4;
        msgid = this._fileContents.slice(position, position + length);

        // matching msgstr
        length = this._fileContents[this._readFunc](offsetTranslations);
        offsetTranslations += 4;
        position = this._fileContents[this._readFunc](offsetTranslations);
        offsetTranslations += 4;
        msgstr = this._fileContents.slice(position, position + length);

        if (!i && !msgid.toString()) {
            this._handleCharset(msgstr);
        }

        msgid = encoding.convert(msgid, 'utf-8', this._charset).toString('utf-8');
        msgstr = encoding.convert(msgstr, 'utf-8', this._charset).toString('utf-8');

        this._addString(msgid, msgstr);
    }

    // dump the file contents object
    this._fileContents = null;
};

/**
 * Detects charset for MO strings from the header
 *
 * @param {Buffer} headers Header value
 */
Parser.prototype._handleCharset = function(headers) {

    var headersStr = headers.toString(),
        match;

    if ((match = headersStr.match(/[; ]charset\s*=\s*([\w\-]+)/i))) {
        this._charset = this._table.charset = sharedFuncs.formatCharset(match[1], this._charset);
    }

    headers = encoding.convert(headers, 'utf-8', this._charset).toString('utf-8');

    this._table.headers = sharedFuncs.parseHeader(headers);
};

/**
 * Adds a translation to the translation object
 *
 * @param {String} msgid Original string
 * @params {String} msgstr Translation for the original string
 */
Parser.prototype._addString = function(msgid, msgstr) {
    var translation = {},
        parts, msgctxt, msgid_plural;

    msgid = msgid.split('\u0004');
    if (msgid.length > 1) {
        msgctxt = msgid.shift();
        translation.msgctxt = msgctxt;
    } else {
        msgctxt = '';
    }
    msgid = msgid.join('\u0004');

    parts = msgid.split('\u0000');
    msgid = parts.shift();

    translation.msgid = msgid;

    if ((msgid_plural = parts.join('\u0000'))) {
        translation.msgid_plural = msgid_plural;
    }

    msgstr = msgstr.split('\u0000');
    translation.msgstr = [].concat(msgstr || []);

    if (!this._table.translations[msgctxt]) {
        this._table.translations[msgctxt] = {};
    }

    this._table.translations[msgctxt][msgid] = translation;
};

/**
 * Parses the MO object and returns translation table
 *
 * @return {Object} Translation table
 */
Parser.prototype.parse = function() {
    if (!this._checkMagick()) {
        return false;
    }

    /**
     * GetText revision nr, usually 0
     */
    this._revision = this._fileContents[this._readFunc](4);

    /**
     * Total count of translated strings
     */
    this._total = this._fileContents[this._readFunc](8);

    /**
     * Offset position for original strings table
     */
    this._offsetOriginals = this._fileContents[this._readFunc](12);

    /**
     * Offset position for translation strings table
     */
    this._offsetTranslations = this._fileContents[this._readFunc](16);

    // Load translations into this._translationTable
    this._loadTranslationTable();

    return this._table;
};