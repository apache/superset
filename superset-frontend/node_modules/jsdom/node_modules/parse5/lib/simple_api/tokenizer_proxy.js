'use strict';

var Tokenizer = require('../tokenization/tokenizer'),
    ForeignContent = require('../common/foreign_content'),
    UNICODE = require('../common/unicode'),
    HTML = require('../common/html');

//Aliases
var $ = HTML.TAG_NAMES,
    NS = HTML.NAMESPACES;


//Tokenizer proxy
//NOTE: this proxy simulates adjustment of the Tokenizer which performed by standard parser during tree construction.
var TokenizerProxy = module.exports = function (html, options) {
    this.tokenizer = new Tokenizer(html, options);

    this.namespaceStack = [];
    this.namespaceStackTop = -1;
    this.currentNamespace = null;
    this.inForeignContent = false;
};

//API
TokenizerProxy.prototype.getNextToken = function () {
    var token = this.tokenizer.getNextToken();

    if (token.type === Tokenizer.START_TAG_TOKEN)
        this._handleStartTagToken(token);

    else if (token.type === Tokenizer.END_TAG_TOKEN)
        this._handleEndTagToken(token);

    else if (token.type === Tokenizer.NULL_CHARACTER_TOKEN && this.inForeignContent) {
        token.type = Tokenizer.CHARACTER_TOKEN;
        token.chars = UNICODE.REPLACEMENT_CHARACTER;
    }

    return token;
};

//Namespace stack mutations
TokenizerProxy.prototype._enterNamespace = function (namespace) {
    this.namespaceStackTop++;
    this.namespaceStack.push(namespace);

    this.inForeignContent = namespace !== NS.HTML;
    this.currentNamespace = namespace;
    this.tokenizer.allowCDATA = this.inForeignContent;
};

TokenizerProxy.prototype._leaveCurrentNamespace = function () {
    this.namespaceStackTop--;
    this.namespaceStack.pop();

    this.currentNamespace = this.namespaceStack[this.namespaceStackTop];
    this.inForeignContent = this.currentNamespace !== NS.HTML;
    this.tokenizer.allowCDATA = this.inForeignContent;
};

//Token handlers
TokenizerProxy.prototype._ensureTokenizerMode = function (tn) {
    if (tn === $.TEXTAREA || tn === $.TITLE)
        this.tokenizer.state = Tokenizer.MODE.RCDATA;

    else if (tn === $.PLAINTEXT)
        this.tokenizer.state = Tokenizer.MODE.PLAINTEXT;

    else if (tn === $.SCRIPT)
        this.tokenizer.state = Tokenizer.MODE.SCRIPT_DATA;

    else if (tn === $.STYLE || tn === $.IFRAME || tn === $.XMP ||
             tn === $.NOEMBED || tn === $.NOFRAMES || tn === $.NOSCRIPT) {
        this.tokenizer.state = Tokenizer.MODE.RAWTEXT;
    }
};

TokenizerProxy.prototype._handleStartTagToken = function (token) {
    var tn = token.tagName;

    if (tn === $.SVG)
        this._enterNamespace(NS.SVG);

    else if (tn === $.MATH)
        this._enterNamespace(NS.MATHML);

    else {
        if (this.inForeignContent) {
            if (ForeignContent.causesExit(token))
                this._leaveCurrentNamespace();

            else if (ForeignContent.isMathMLTextIntegrationPoint(tn, this.currentNamespace) ||
                     ForeignContent.isHtmlIntegrationPoint(tn, this.currentNamespace, token.attrs)) {
                this._enterNamespace(NS.HTML);
            }
        }

        else
            this._ensureTokenizerMode(tn);
    }
};

TokenizerProxy.prototype._handleEndTagToken = function (token) {
    var tn = token.tagName;

    if (!this.inForeignContent) {
        var previousNs = this.namespaceStack[this.namespaceStackTop - 1];

        //NOTE: check for exit from integration point
        if (ForeignContent.isMathMLTextIntegrationPoint(tn, previousNs) ||
            ForeignContent.isHtmlIntegrationPoint(tn, previousNs, token.attrs)) {
            this._leaveCurrentNamespace();
        }

        else if (tn === $.SCRIPT)
            this.tokenizer.state = Tokenizer.MODE.DATA;
    }

    else if ((tn === $.SVG && this.currentNamespace === NS.SVG) ||
             (tn === $.MATH && this.currentNamespace === NS.MATHML))
        this._leaveCurrentNamespace();
};
