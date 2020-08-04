"use strict";

exports.__esModule = true;
exports.default = void 0;

var _loaderUtils = require("loader-utils");

var _core = require("@babel/core");

var _core2 = _interopRequireDefault(require("@svgr/core"));

var _pluginSvgo = _interopRequireDefault(require("@svgr/plugin-svgo"));

var _pluginJsx = _interopRequireDefault(require("@svgr/plugin-jsx"));

var _presetReact = _interopRequireDefault(require("@babel/preset-react"));

var _presetEnv = _interopRequireDefault(require("@babel/preset-env"));

var _pluginTransformReactConstantElements = _interopRequireDefault(require("@babel/plugin-transform-react-constant-elements"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }

const babelOptions = {
  babelrc: false,
  configFile: false,
  presets: [(0, _core.createConfigItem)(_presetReact.default, {
    type: 'preset'
  }), (0, _core.createConfigItem)([_presetEnv.default, {
    modules: false
  }], {
    type: 'preset'
  })],
  plugins: [(0, _core.createConfigItem)(_pluginTransformReactConstantElements.default)]
};

function svgrLoader(source) {
  const callback = this.async();

  const _ref = (0, _loaderUtils.getOptions)(this) || {},
        {
    babel = true
  } = _ref,
        options = _objectWithoutPropertiesLoose(_ref, ["babel"]);

  const readSvg = () => new Promise((resolve, reject) => {
    this.fs.readFile(this.resourcePath, (err, result) => {
      if (err) reject(err);
      resolve(result);
    });
  });

  const previousExport = (() => {
    if (source.toString('utf-8').startsWith('export ')) {
      return source;
    }

    const exportMatches = source.toString('utf-8').match(/^module.exports\s*=\s*(.*)/);
    return exportMatches ? `export default ${exportMatches[1]}` : null;
  })();

  const tranformSvg = svg => (0, _core2.default)(svg, options, {
    caller: {
      name: '@svgr/webpack',
      previousExport,
      defaultPlugins: [_pluginSvgo.default, _pluginJsx.default]
    },
    filePath: this.resourcePath
  }).then(jsCode => {
    if (!babel) return jsCode;
    return (0, _core.transformAsync)(jsCode, babelOptions).then(({
      code
    }) => code);
  }).then(result => callback(null, result)).catch(err => callback(err));

  if (previousExport) {
    readSvg().then(tranformSvg);
  } else {
    tranformSvg(source);
  }
}

var _default = svgrLoader;
exports.default = _default;