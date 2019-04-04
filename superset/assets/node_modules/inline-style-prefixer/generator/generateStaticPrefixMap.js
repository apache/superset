'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = generateStaticPrefixMap;

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

  // remove flexprops from IE
};var flexPropsIE = ['alignContent', 'alignSelf', 'alignItems', 'justifyContent', 'order', 'flexGrow', 'flexShrink', 'flexBasis'];

function filterAndRemoveIfEmpty(map, property, filter) {
  map[property] = map[property].filter(filter);

  if (map[property].length === 0) {
    delete map[property];
  }
}

function generateStaticPrefixMap(browserList) {
  var prefixMap = {};

  for (var browser in prefixBrowserMap) {
    var prefix = prefixBrowserMap[browser];

    for (var keyword in _propertyMap2.default) {
      var keywordProperties = [].concat(_propertyMap2.default[keyword]);
      var versions = (0, _caniuseApi.getSupport)(keyword);

      for (var i = 0, len = keywordProperties.length; i < len; ++i) {
        if (versions[browser].x >= browserList[browser]) {
          var property = keywordProperties[i];
          if (!prefixMap[property]) {
            prefixMap[property] = [];
          }

          if (prefixMap[property].indexOf(prefix) === -1) {
            prefixMap[property].push(prefix);
          }
        }
      }
    }
  }

  // remove flexProps from IE and Firefox due to alternative syntax
  for (var _i = 0, _len = flexPropsIE.length; _i < _len; ++_i) {
    filterAndRemoveIfEmpty(prefixMap, flexPropsIE[_i], function (prefix) {
      return prefix !== 'ms' && prefix !== 'Moz';
    });
  }

  // remove transition from Moz and Webkit as they are handled
  // specially by the transition plugins
  filterAndRemoveIfEmpty(prefixMap, 'transition', function (prefix) {
    return prefix !== 'Moz' && prefix !== 'Webkit';
  });

  // remove WebkitFlexDirection as it does not exist
  filterAndRemoveIfEmpty(prefixMap, 'flexDirection', function (prefix) {
    return prefix !== 'Moz';
  });

  return prefixMap;
}
module.exports = exports['default'];