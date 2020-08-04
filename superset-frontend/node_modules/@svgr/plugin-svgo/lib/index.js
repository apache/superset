"use strict";

exports.__esModule = true;
exports.default = svgoPlugin;

var _svgo = _interopRequireDefault(require("svgo"));

var _cosmiconfig = require("cosmiconfig");

var _config = require("./config");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* eslint-disable no-underscore-dangle */
const explorer = (0, _cosmiconfig.cosmiconfigSync)('svgo', {
  searchPlaces: ['package.json', '.svgorc', '.svgorc.json', '.svgorc.yaml', '.svgorc.yml', 'svgo.config.js', '.svgo.yml'],
  transform: result => result && result.config,
  cache: true
});

function encodeSVGDatauri(str, type) {
  let prefix = 'data:image/svg+xml'; // base64

  if (!type || type === 'base64') {
    prefix += ';base64,';

    if (Buffer.from) {
      str = prefix + Buffer.from(str).toString('base64');
    } else {
      // eslint-disable-next-line
      str = prefix + new Buffer(str).toString('base64');
    } // URI encoded

  } else if (type === 'enc') {
    str = `${prefix},${encodeURIComponent(str)}`; // unencoded
  } else if (type === 'unenc') {
    str = `${prefix},${str}`;
  }

  return str;
} // See https://github.com/svg/svgo/blob/master/lib/svgo.js#L24
// _optimizeOnce is synchronous internally


function optimizeSync(svgstr, info) {
  const {
    config
  } = this;

  if (config.error) {
    throw config.error;
  }

  const maxPassCount = config.multipass ? 10 : 1;
  let counter = 0;
  let prevResultSize = Number.POSITIVE_INFINITY;
  let result;

  const optimizeOnceCallback = svgjs => {
    if (svgjs.error) {
      throw svgjs.error;
    } // eslint-disable-next-line no-plusplus


    if (++counter < maxPassCount && svgjs.data.length < prevResultSize) {
      prevResultSize = svgjs.data.length;

      this._optimizeOnce(svgjs.data, info, optimizeOnceCallback);
    } else {
      if (config.datauri) {
        svgjs.data = encodeSVGDatauri(svgjs.data, config.datauri);
      }

      if (info.path) {
        svgjs.path = info.path;
      }

      result = svgjs;
    }
  };

  this._optimizeOnce(svgstr, info, optimizeOnceCallback);

  return result;
}

function createSvgo(config, rcConfig) {
  const baseSvgoConfig = (0, _config.getBaseSvgoConfig)(config);
  const mergedConfig = (0, _config.mergeSvgoConfig)(baseSvgoConfig, rcConfig, config.svgoConfig);
  return new _svgo.default(mergedConfig);
}

function getInfo(state) {
  return state.filePath ? {
    input: 'file',
    path: state.filePath
  } : {
    input: 'string'
  };
}

function svgoPlugin(code, config, state) {
  if (!config.svgo) return code;
  const filePath = (0, _config.getFilePath)(state);
  const svgoRcConfig = config.runtimeConfig ? explorer.search(filePath) : {};
  const svgo = createSvgo(config, svgoRcConfig);
  const {
    data
  } = optimizeSync.call(svgo, code, getInfo(state));
  return data;
}