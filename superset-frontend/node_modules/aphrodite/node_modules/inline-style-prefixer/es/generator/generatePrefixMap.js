import { getSupport } from 'caniuse-api';

import propertyMap from './maps/propertyMap';

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
  if (map[property]) {
    map[property] = map[property].filter(filter);

    if (map[property].length === 0) {
      delete map[property];
    }
  }
}

export default function generatePrefixMap(browserList) {
  var prefixMap = {};

  for (var browser in prefixBrowserMap) {
    var prefix = prefixBrowserMap[browser];

    for (var keyword in propertyMap) {
      var keywordProperties = [].concat(propertyMap[keyword]);
      var versions = getSupport(keyword);

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