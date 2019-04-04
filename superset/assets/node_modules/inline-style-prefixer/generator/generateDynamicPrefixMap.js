'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

exports.default = generateDynamicPrefixMap;

var _caniuseApi = require('caniuse-api');

var _propertyMap = require('./maps/propertyMap');

var _propertyMap2 = _interopRequireDefault(_propertyMap);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var prefixBrowserMap = {
  chrome: 'Webkit',
  safari: 'Webkit',
  firefox: 'Moz',
  opera: 'Webkit',
  ie: 'ms',
  edge: 'ms',
  ios_saf: 'Webkit',
  android: 'Webkit',
  and_chr: 'Webkit',
  and_uc: 'Webkit',
  op_mini: 'Webkit',
  ie_mob: 'ms'
};

var browsers = Object.keys(prefixBrowserMap);

// remove flexprops from IE
var flexPropsIE = ['alignContent', 'alignSelf', 'alignItems', 'justifyContent', 'order', 'flexGrow', 'flexShrink', 'flexBasis'];

function generateDynamicPrefixMap(browserList) {
  var prefixMap = {};

  for (var i = 0, len = browsers.length; i < len; ++i) {
    var browser = browsers[i];
    if (!prefixMap.hasOwnProperty(browser)) {
      prefixMap[browser] = {};
    }

    for (var keyword in _propertyMap2.default) {
      var keywordProperties = [].concat(_propertyMap2.default[keyword]);
      var versions = (0, _caniuseApi.getSupport)(keyword);

      for (var j = 0, kLen = keywordProperties.length; j < kLen; ++j) {
        if (versions[browser].x >= browserList[browser]) {
          prefixMap[browser][keywordProperties[j]] = versions[browser].x;
        }
      }
    }
  }

  prefixMap.ie = _extends({}, prefixMap.ie, prefixMap.ie_mob);

  delete prefixMap.ie_mob;

  // remove flexProps from IE due to alternative syntax
  for (var _i = 0, _len = flexPropsIE.length; _i < _len; ++_i) {
    delete prefixMap.ie[flexPropsIE[_i]];
  }

  return prefixMap;
}
module.exports = exports['default'];