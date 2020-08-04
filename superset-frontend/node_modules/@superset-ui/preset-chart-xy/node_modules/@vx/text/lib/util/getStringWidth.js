"use strict";

exports.__esModule = true;
exports.default = void 0;

var _memoize = _interopRequireDefault(require("lodash/memoize"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var MEASUREMENT_ELEMENT_ID = '__react_svg_text_measurement_id';

function getStringWidth(str, style) {
  try {
    // Calculate length of each word to be used to determine number of words per line
    var textEl = document.getElementById(MEASUREMENT_ELEMENT_ID);

    if (!textEl) {
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.style.width = '0';
      svg.style.height = '0';
      svg.style.position = 'absolute';
      svg.style.top = '-100%';
      svg.style.left = '-100%';
      textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      textEl.setAttribute('id', MEASUREMENT_ELEMENT_ID);
      svg.appendChild(textEl);
      document.body.appendChild(svg);
    }

    Object.assign(textEl.style, style);
    textEl.textContent = str;
    return textEl.getComputedTextLength();
  } catch (e) {
    return null;
  }
}

var _default = (0, _memoize.default)(getStringWidth, function (str, style) {
  return str + "_" + JSON.stringify(style);
});

exports.default = _default;