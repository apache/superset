"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var chalk_1 = require("chalk");
var os = require("os");
/**
 * Creates new default formatter.
 *
 * @returns {defaultFormatter}
 */
function createDefaultFormatter() {
    return function defaultFormatter(message, useColors) {
        var colors = new chalk_1.default.constructor({ enabled: useColors });
        var messageColor = message.isWarningSeverity()
            ? colors.bold.yellow
            : colors.bold.red;
        var fileAndNumberColor = colors.bold.cyan;
        var codeColor = colors.grey;
        return [
            messageColor(message.getSeverity().toUpperCase() + " in ") +
                fileAndNumberColor(message.getFile() + "(" + message.getLine() + "," + message.getCharacter() + ")") +
                messageColor(':'),
            codeColor(message.getFormattedCode() + ': ') + message.getContent()
        ].join(os.EOL);
    };
}
exports.createDefaultFormatter = createDefaultFormatter;
