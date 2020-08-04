var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

import generatePrefixMap from './generatePrefixMap';
import generatePluginList from './generatePluginList';

function generateImportString(plugin, compatibility) {
  if (compatibility) {
    return 'var ' + plugin + ' = require(\'inline-style-prefixer/lib/plugins/' + plugin + '\')';
  }
  return 'import ' + plugin + ' from \'inline-style-prefixer/lib/plugins/' + plugin + '\'';
}

export function generateFile(prefixMap, pluginList, compatibility) {
  var pluginImports = pluginList.map(function (plugin) {
    return generateImportString(plugin, compatibility);
  }).join('\n');

  var moduleExporter = compatibility ? 'module.exports = ' : 'export default';
  var pluginExport = '[' + pluginList.join(',') + ']';
  var prefixMapExport = JSON.stringify(prefixMap);

  var prefixVariables = ['var w = ["Webkit"];', 'var m = ["Moz"];', 'var ms = ["ms"];', 'var wm = ["Webkit","Moz"];', 'var wms = ["Webkit","ms"];', 'var wmms = ["Webkit","Moz","ms"];'].join('\n');

  return pluginImports + '\n' + prefixVariables + '\n\n' + moduleExporter + ' {\n  plugins: ' + pluginExport + ',\n  prefixMap: ' + prefixMapExport.replace(/\["Webkit"\]/g, 'w').replace(/\["Moz"\]/g, 'm').replace(/\["ms"\]/g, 'ms').replace(/\["Webkit","Moz"\]/g, 'wm').replace(/\["Webkit","ms"\]/g, 'wms').replace(/\["Webkit","Moz","ms"\]/g, 'wmms') + '\n}';
}

function saveFile(fileContent, path) {
  /* eslint-disable global-require */
  var fs = require('fs');
  /* eslint-enable global-require */

  fs.writeFile(path, fileContent, function (err) {
    if (err) {
      throw err;
    }

    console.log('Successfully saved data to "' + path + '".');
  });
}

var defaultOptions = {
  prefixMap: true,
  plugins: true,
  compatibility: false
};

export default function generateData(browserList) {
  var userOptions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  var options = _extends({}, defaultOptions, userOptions);

  var compatibility = options.compatibility,
      plugins = options.plugins,
      path = options.path,
      prefixMap = options.prefixMap;


  var requiredPrefixMap = prefixMap ? generatePrefixMap(browserList) : {};
  var requiredPlugins = plugins ? generatePluginList(browserList) : [];

  if (path) {
    saveFile(generateFile(requiredPrefixMap, requiredPlugins, compatibility), path);
  }

  return {
    prefixMap: requiredPrefixMap,
    plugins: requiredPlugins
  };
}