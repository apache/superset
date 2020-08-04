'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = getRecommendedPlugins;

var _pluginMap = require('./maps/pluginMap');

var _pluginMap2 = _interopRequireDefault(_pluginMap);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function getRecommendedPlugins(browserList) {
  var recommendedPlugins = {};

  for (var plugin in _pluginMap2.default) {
    var browserSupportByPlugin = _pluginMap2.default[plugin];

    for (var browser in browserSupportByPlugin) {
      if (browserList.hasOwnProperty(browser)) {
        var browserVersion = browserSupportByPlugin[browser];

        if (browserList[browser] < browserVersion) {
          recommendedPlugins[plugin] = true;
        }
      }
    }
  }

  return Object.keys(recommendedPlugins);
}