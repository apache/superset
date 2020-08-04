import pluginMap from './maps/pluginMap';

export default function getRecommendedPlugins(browserList) {
  var recommendedPlugins = {};

  for (var plugin in pluginMap) {
    var browserSupportByPlugin = pluginMap[plugin];

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