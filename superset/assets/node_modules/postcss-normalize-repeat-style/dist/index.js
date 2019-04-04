'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _postcss = require('postcss');

var _postcss2 = _interopRequireDefault(_postcss);

var _postcssValueParser = require('postcss-value-parser');

var _postcssValueParser2 = _interopRequireDefault(_postcssValueParser);

var _cssnanoUtilGetArguments = require('cssnano-util-get-arguments');

var _cssnanoUtilGetArguments2 = _interopRequireDefault(_cssnanoUtilGetArguments);

var _cssnanoUtilGetMatch = require('cssnano-util-get-match');

var _cssnanoUtilGetMatch2 = _interopRequireDefault(_cssnanoUtilGetMatch);

var _map = require('./lib/map');

var _map2 = _interopRequireDefault(_map);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function evenValues(list, index) {
    return index % 2 === 0;
}

const repeatKeywords = _map2.default.map(mapping => mapping[0]);

const getMatch = (0, _cssnanoUtilGetMatch2.default)(_map2.default);

function transform(decl) {
    const values = (0, _postcssValueParser2.default)(decl.value);
    if (values.nodes.length === 1) {
        return;
    }
    const args = (0, _cssnanoUtilGetArguments2.default)(values);
    const relevant = [];
    args.forEach(arg => {
        relevant.push({
            start: null,
            end: null
        });
        arg.forEach((part, index) => {
            const isRepeat = ~repeatKeywords.indexOf(part.value.toLowerCase());
            const len = relevant.length - 1;
            if (relevant[len].start === null && isRepeat) {
                relevant[len].start = index;
                relevant[len].end = index;
                return;
            }
            if (relevant[len].start !== null) {
                if (part.type === 'space') {
                    return;
                } else if (isRepeat) {
                    relevant[len].end = index;
                    return;
                }
                return;
            }
        });
    });
    relevant.forEach((range, index) => {
        if (range.start === null) {
            return;
        }
        const val = args[index].slice(range.start, range.end + 1);
        if (val.length !== 3) {
            return;
        }
        const match = getMatch(val.filter(evenValues).map(n => n.value.toLowerCase()));
        if (match) {
            args[index][range.start].value = match;
            args[index][range.start + 1].value = '';
            args[index][range.end].value = '';
        }
    });
    decl.value = values.toString();
}

exports.default = _postcss2.default.plugin('postcss-normalize-repeat-style', () => {
    return css => css.walkDecls(/background(-repeat)?|(-webkit-)?mask-repeat/i, transform);
});
module.exports = exports['default'];