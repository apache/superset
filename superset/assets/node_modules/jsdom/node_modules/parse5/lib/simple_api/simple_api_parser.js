'use strict';

var Tokenizer = require('../tokenization/tokenizer'),
    TokenizerProxy = require('./tokenizer_proxy'),
    Utils = require('../common/utils');

//Default options
var DEFAULT_OPTIONS = {
    decodeHtmlEntities: true,
    locationInfo: false
};

//Skipping handler
function skip() {
    //NOTE: do nothing =)
}

//SimpleApiParser
var SimpleApiParser = module.exports = function (handlers, options) {
    this.options = Utils.mergeOptions(DEFAULT_OPTIONS, options);
    this.handlers = {
        doctype: this._wrapHandler(handlers.doctype),
        startTag: this._wrapHandler(handlers.startTag),
        endTag: this._wrapHandler(handlers.endTag),
        text: this._wrapHandler(handlers.text),
        comment: this._wrapHandler(handlers.comment)
    };
};

SimpleApiParser.prototype._wrapHandler = function (handler) {
    var parser = this;

    handler = handler || skip;

    if (this.options.locationInfo) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            args.push(parser.currentTokenLocation);
            handler.apply(handler, args);
        };
    }

    return handler;
};

//API
SimpleApiParser.prototype.parse = function (html) {
    var token = null;

    this._reset(html);

    do {
        token = this.tokenizerProxy.getNextToken();

        if (token.type === Tokenizer.CHARACTER_TOKEN ||
            token.type === Tokenizer.WHITESPACE_CHARACTER_TOKEN ||
            token.type === Tokenizer.NULL_CHARACTER_TOKEN) {

            if (this.options.locationInfo) {
                if (this.pendingText === null)
                    this.currentTokenLocation = token.location;

                else
                    this.currentTokenLocation.end = token.location.end;
            }

            this.pendingText = (this.pendingText || '') + token.chars;
        }

        else {
            this._emitPendingText();
            this._handleToken(token);
        }
    } while (token.type !== Tokenizer.EOF_TOKEN);
};

//Internals
SimpleApiParser.prototype._handleToken = function (token) {
    if (this.options.locationInfo)
        this.currentTokenLocation = token.location;

    if (token.type === Tokenizer.START_TAG_TOKEN)
        this.handlers.startTag(token.tagName, token.attrs, token.selfClosing);

    else if (token.type === Tokenizer.END_TAG_TOKEN)
        this.handlers.endTag(token.tagName);

    else if (token.type === Tokenizer.COMMENT_TOKEN)
        this.handlers.comment(token.data);

    else if (token.type === Tokenizer.DOCTYPE_TOKEN)
        this.handlers.doctype(token.name, token.publicId, token.systemId);

};

SimpleApiParser.prototype._reset = function (html) {
    this.tokenizerProxy = new TokenizerProxy(html, this.options);
    this.pendingText = null;
    this.currentTokenLocation = null;
};

SimpleApiParser.prototype._emitPendingText = function () {
    if (this.pendingText !== null) {
        this.handlers.text(this.pendingText);
        this.pendingText = null;
    }
};
