'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

exports.generateFile = generateFile;
exports.default = generateData;

var _generatePrefixMap = require('./generatePrefixMap');

var _generatePrefixMap2 = _interopRequireDefault(_generatePrefixMap);

var _generatePluginList = require('./generatePluginList');

var _generatePluginList2 = _interopRequireDefault(_generatePluginList);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function generateImportString(plugin, compatibility) {
  if (compatibility) {
    return 'var ' + plugin + ' = require(\'inline-style-prefixer/lib/plugins/' + plugin + '\')';
  }
  return 'import ' + plugin + ' from \'inline-style-prefixer/lib/plugins/' + plugin + '\'';
}

function generateFile(prefixMap, pluginList, compatibility) {
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

function generateData(browserList) {
  var userOptions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  var options = _extends({}, defaultOptions, userOptions);

  var compatibility = options.compatibility,
      plugins = options.plugins,
      path = options.path,
      prefixMap = options.prefixMap;


  var requiredPrefixMap = prefixMap ? (0, _generatePrefixMap2.default)(browserList) : {};
  var requiredPlugins = plugins ? (0, _generatePluginList2.default)(browserList) : [];

  if (path) {
    saveFile(generateFile(requiredPrefixMap, requiredPlugins, compatibility), path);
  }

  return {
    prefixMap: requiredPrefixMap,
    plugins: requiredPlugins
  };
}