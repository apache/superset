"use strict";

exports.__esModule = true;
exports.default = void 0;

var _state = require("./state");

var _config = require("./config");

var _plugins = require("./plugins");

function run(code, config, state) {
  const expandedState = (0, _state.expandState)(state);
  const plugins = (0, _plugins.getPlugins)(config, state).map(_plugins.resolvePlugin);
  let nextCode = String(code).replace('\0', ''); // eslint-disable-next-line no-restricted-syntax

  for (const plugin of plugins) {
    nextCode = plugin(nextCode, config, expandedState);
  }

  return nextCode;
}

async function convert(code, config = {}, state = {}) {
  config = await (0, _config.loadConfig)(config, state);
  return run(code, config, state);
}

convert.sync = (code, config = {}, state = {}) => {
  config = _config.loadConfig.sync(config, state);
  return run(code, config, state);
};

var _default = convert;
exports.default = _default;