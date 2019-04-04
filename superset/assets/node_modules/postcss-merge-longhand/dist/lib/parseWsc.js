'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = parseWsc;

var _postcss = require('postcss');

var _validateWsc = require('./validateWsc');

const none = /^\s*(none|medium)(\s+none(\s+(none|currentcolor))?)?\s*$/i;

function parseWsc(value) {
    if (none.test(value)) {
        return ['medium', 'none', 'currentcolor'];
    }

    let width, style, color;

    const values = _postcss.list.space(value);
    if (values.length > 1 && (0, _validateWsc.isStyle)(values[1]) && values[0].toLowerCase() === 'none') {
        values.unshift();
        width = '0';
    }

    const unknown = [];

    values.forEach(v => {
        if ((0, _validateWsc.isStyle)(v)) {
            style = v.toLowerCase();
        } else if ((0, _validateWsc.isWidth)(v)) {
            width = v.toLowerCase();
        } else if ((0, _validateWsc.isColor)(v)) {
            color = v.toLowerCase();
        } else {
            unknown.push(v);
        }
    });

    if (unknown.length) {
        if (!width && style && color) {
            width = unknown.pop();
        }
        if (width && !style && color) {
            style = unknown.pop();
        }
        if (width && style && !color) {
            color = unknown.pop();
        }
    }

    return [width, style, color];
}
module.exports = exports['default'];