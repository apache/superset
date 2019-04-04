'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _color = require('color');

var _color2 = _interopRequireDefault(_color);

var _keywords = require('./keywords.json');

var _keywords2 = _interopRequireDefault(_keywords);

var _toShorthand = require('./lib/toShorthand');

var _toShorthand2 = _interopRequireDefault(_toShorthand);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const shorter = (a, b) => (a && a.length < b.length ? a : b).toLowerCase();

exports.default = (colour, legacy = false) => {
    try {
        const parsed = (0, _color2.default)(colour.toLowerCase());
        const alpha = parsed.alpha();
        if (alpha === 1) {
            const toHex = (0, _toShorthand2.default)(parsed.hex().toLowerCase());
            return shorter(_keywords2.default[toHex], toHex);
        } else {
            const rgb = parsed.rgb();
            if (!legacy && !rgb.color[0] && !rgb.color[1] && !rgb.color[2] && !alpha) {
                return 'transparent';
            }
            let hsla = parsed.hsl().string();
            let rgba = rgb.string();
            return hsla.length < rgba.length ? hsla : rgba;
        }
    } catch (e) {
        // Possibly malformed, so pass through
        return colour;
    }
};