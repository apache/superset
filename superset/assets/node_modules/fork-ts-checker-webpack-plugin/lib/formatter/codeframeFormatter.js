"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var os = require("os");
var codeFrame = require("babel-code-frame");
var chalk_1 = require("chalk");
var fs = require("fs");
/**
 * Create new code frame formatter.
 *
 * @param options Options for babel-code-frame - see https://www.npmjs.com/package/babel-code-frame
 * @returns {codeframeFormatter}
 */
function createCodeframeFormatter(options) {
    return function codeframeFormatter(message, useColors) {
        var colors = new chalk_1.default.constructor({ enabled: useColors });
        var messageColor = message.isWarningSeverity()
            ? colors.bold.yellow
            : colors.bold.red;
        var positionColor = colors.dim;
        var source = message.getFile() &&
            fs.existsSync(message.getFile()) &&
            fs.readFileSync(message.getFile(), 'utf-8');
        var frame = '';
        if (source) {
            frame = codeFrame(source, message.line, message.character, Object.assign({}, options || {}, { highlightCode: useColors }))
                .split('\n')
                .map(function (str) { return '  ' + str; })
                .join(os.EOL);
        }
        return (messageColor(message.getSeverity().toUpperCase() + ' in ' + message.getFile()) +
            os.EOL +
            positionColor(message.getLine() + ':' + message.getCharacter()) +
            ' ' +
            message.getContent() +
            (frame ? os.EOL + frame : ''));
    };
}
exports.createCodeframeFormatter = createCodeframeFormatter;
