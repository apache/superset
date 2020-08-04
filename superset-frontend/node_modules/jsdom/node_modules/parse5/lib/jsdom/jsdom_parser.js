'use strict';

var Parser = require('../tree_construction/parser'),
    ParsingUnit = require('./parsing_unit');

//API
exports.parseDocument = function (html, treeAdapter) {
    //NOTE: this should be reentrant, so we create new parser here
    var parser = new Parser(treeAdapter),
        parsingUnit = new ParsingUnit(parser);

    //NOTE: override parser loop method
    parser._runParsingLoop = function () {
        parsingUnit.parsingLoopLock = true;

        while (!parsingUnit.suspended && !this.stopped)
            this._iterateParsingLoop();

        parsingUnit.parsingLoopLock = false;

        if (this.stopped)
            parsingUnit.callback(this.document);
    };

    //NOTE: wait while parserController will be adopted by calling code, then
    //start parsing
    process.nextTick(function () {
        parser.parse(html);
    });

    return parsingUnit;
};

exports.parseInnerHtml = function (innerHtml, contextElement, treeAdapter) {
    //NOTE: this should be reentrant, so we create new parser here
    var parser = new Parser(treeAdapter);

    return parser.parseFragment(innerHtml, contextElement);
};