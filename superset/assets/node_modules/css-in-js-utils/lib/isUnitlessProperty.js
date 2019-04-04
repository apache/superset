'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = isUnitlessProperty;

var _hyphenateProperty = require('./hyphenateProperty');

var _hyphenateProperty2 = _interopRequireDefault(_hyphenateProperty);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var unitlessProperties = {
  borderImageOutset: true,
  borderImageSlice: true,
  borderImageWidth: true,
  fontWeight: true,
  lineHeight: true,
  opacity: true,
  orphans: true,
  tabSize: true,
  widows: true,
  zIndex: true,
  zoom: true,
  // SVG-related properties
  fillOpacity: true,
  floodOpacity: true,
  stopOpacity: true,
  strokeDasharray: true,
  strokeDashoffset: true,
  strokeMiterlimit: true,
  strokeOpacity: true,
  strokeWidth: true
};


var prefixedUnitlessProperties = ['animationIterationCount', 'boxFlex', 'boxFlexGroup', 'boxOrdinalGroup', 'columnCount', 'flex', 'flexGrow', 'flexPositive', 'flexShrink', 'flexNegative', 'flexOrder', 'gridRow', 'gridColumn', 'order', 'lineClamp'];

var prefixes = ['Webkit', 'ms', 'Moz', 'O'];

function getPrefixedProperty(prefix, property) {
  return prefix + property.charAt(0).toUpperCase() + property.slice(1);
}

// add all prefixed properties to the unitless properties
for (var i = 0, len = prefixedUnitlessProperties.length; i < len; ++i) {
  var property = prefixedUnitlessProperties[i];
  unitlessProperties[property] = true;

  for (var j = 0, jLen = prefixes.length; j < jLen; ++j) {
    unitlessProperties[getPrefixedProperty(prefixes[j], property)] = true;
  }
}

// add all hypenated properties as well
for (var _property in unitlessProperties) {
  unitlessProperties[(0, _hyphenateProperty2.default)(_property)] = true;
}

function isUnitlessProperty(property) {
  return unitlessProperties.hasOwnProperty(property);
}
module.exports = exports['default'];