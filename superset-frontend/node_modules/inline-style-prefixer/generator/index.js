'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = generateData;

var _generateStaticPrefixMap = require('./generateStaticPrefixMap');

var _generateStaticPrefixMap2 = _interopRequireDefault(_generateStaticPrefixMap);

var _generateDynamicPrefixMap = require('./generateDynamicPrefixMap');

var _generateDynamicPrefixMap2 = _interopRequireDefault(_generateDynamicPrefixMap);

var _generatePluginList = require('./generatePluginList');

var _generatePluginList2 = _interopRequireDefault(_generatePluginList);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function generateImportString(plugin, pluginPath, compatibility) {
  if (compatibility) {
    return 'var ' + plugin + ' = require(\'inline-style-prefixer/' + pluginPath + '/plugins/' + plugin + '\')';
  }
  return 'import ' + plugin + ' from \'inline-style-prefixer/' + pluginPath + '/plugins/' + plugin + '\'';
}


function generateFile(prefixMap, pluginList, compatibility, pluginPath) {
  var pluginImports = pluginList.map(function (plugin) {
    return generateImportString(plugin, pluginPath, compatibility);
  }).join('\n');

  var moduleExporter = compatibility ? 'module.exports = ' : 'export default';
  var pluginExport = '[' + pluginList.join(',') + ']';
  var prefixMapExport = JSON.stringify(prefixMap);

  if (pluginPath === 'static') {
    var prefixVariables = ['var w = ["Webkit"];', 'var m = ["Moz"];', 'var ms = ["ms"];', 'var wm = ["Webkit","Moz"];', 'var wms = ["Webkit","ms"];', 'var wmms = ["Webkit","Moz","ms"];'].join('\n');

    return pluginImports + '\n' + prefixVariables + '\n\n' + moduleExporter + ' {\n  plugins: ' + pluginExport + ',\n  prefixMap: ' + prefixMapExport.replace(/\["Webkit"\]/g, 'w').replace(/\["Moz"\]/g, 'm').replace(/\["ms"\]/g, 'ms').replace(/\["Webkit","Moz"\]/g, 'wm').replace(/\["Webkit","ms"\]/g, 'wms').replace(/\["Webkit","Moz","ms"\]/g, 'wmms') + '\n}';
  }

  return pluginImports + '\n\n' + moduleExporter + ' {\n  plugins: ' + pluginExport + ',\n  prefixMap: ' + prefixMapExport + '\n}';
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

function generateData(browserList) {
  var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
      compatibility = _ref.compatibility,
      plugins = _ref.plugins,
      staticPath = _ref.staticPath,
      dynamicPath = _ref.dynamicPath,
      prefixMap = _ref.prefixMap;

  var shouldRenderPlugins = plugins !== undefined ? plugins : true;
  var shouldRenderPrefixMap = prefixMap !== undefined ? prefixMap : true;

  var data = {
    static: shouldRenderPrefixMap ? (0, _generateStaticPrefixMap2.default)(browserList) : {},
    dynamic: shouldRenderPrefixMap ? (0, _generateDynamicPrefixMap2.default)(browserList) : {},
    plugins: shouldRenderPlugins ? (0, _generatePluginList2.default)(browserList) : []
  };

  if (staticPath) {
    var fileContent = generateFile(data.static, data.plugins, compatibility, 'static');

    saveFile(fileContent, staticPath);
  }

  if (dynamicPath) {
    var _fileContent = generateFile(data.dynamic, data.plugins, compatibility, 'dynamic');

    saveFile(_fileContent, dynamicPath);
  }

  return data;
}
module.exports = exports['default'];