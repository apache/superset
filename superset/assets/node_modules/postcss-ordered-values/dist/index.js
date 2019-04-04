'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _postcss = require('postcss');

var _postcss2 = _interopRequireDefault(_postcss);

var _getParsed = require('./lib/getParsed');

var _getParsed2 = _interopRequireDefault(_getParsed);

var _animation = require('./rules/animation');

var _animation2 = _interopRequireDefault(_animation);

var _border = require('./rules/border');

var _border2 = _interopRequireDefault(_border);

var _boxShadow = require('./rules/boxShadow');

var _boxShadow2 = _interopRequireDefault(_boxShadow);

var _flexFlow = require('./rules/flexFlow');

var _flexFlow2 = _interopRequireDefault(_flexFlow);

var _transition = require('./rules/transition');

var _transition2 = _interopRequireDefault(_transition);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* eslint-disable quote-props */

const rules = {
    'animation': _animation2.default,
    '-webkit-animation': _animation2.default,
    'border': _border2.default,
    'border-top': _border2.default,
    'border-right': _border2.default,
    'border-bottom': _border2.default,
    'border-left': _border2.default,
    'outline': _border2.default,
    'box-shadow': _boxShadow2.default,
    'flex-flow': _flexFlow2.default,
    'transition': _transition2.default,
    '-webkit-transition': _transition2.default
};

/* eslint-enable */

// rules
function shouldAbort(parsed) {
    let abort = false;
    parsed.walk(({ type, value }) => {
        if (type === 'comment' || type === 'function' && value.toLowerCase() === 'var' || type === 'word' && ~value.indexOf(`___CSS_LOADER_IMPORT___`)) {
            abort = true;
            return false;
        }
    });
    return abort;
}

exports.default = _postcss2.default.plugin('postcss-ordered-values', () => {
    return css => {
        css.walkDecls(decl => {
            const processor = rules[decl.prop.toLowerCase()];
            if (!processor) {
                return;
            }
            const parsed = (0, _getParsed2.default)(decl);
            if (parsed.nodes.length < 2 || shouldAbort(parsed)) {
                return;
            }
            processor(decl, parsed);
        });
    };
});
module.exports = exports['default'];