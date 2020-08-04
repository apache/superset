"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

function _gensync() {
  const data = _interopRequireDefault(require("gensync"));

  _gensync = function () {
    return data;
  };

  return data;
}

var _async = require("../gensync-utils/async");

var _util = require("./util");

var context = _interopRequireWildcard(require("../index"));

var _plugin = _interopRequireDefault(require("./plugin"));

var _item = require("./item");

var _configChain = require("./config-chain");

function _traverse() {
  const data = _interopRequireDefault(require("@babel/traverse"));

  _traverse = function () {
    return data;
  };

  return data;
}

var _caching = require("./caching");

var _options = require("./validation/options");

var _plugins = require("./validation/plugins");

var _configApi = _interopRequireDefault(require("./helpers/config-api"));

var _partial = _interopRequireDefault(require("./partial"));

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _default = (0, _gensync().default)(function* loadFullConfig(inputOpts) {
  const result = yield* (0, _partial.default)(inputOpts);

  if (!result) {
    return null;
  }

  const {
    options,
    context
  } = result;
  const optionDefaults = {};
  const passes = [[]];

  try {
    const {
      plugins,
      presets
    } = options;

    if (!plugins || !presets) {
      throw new Error("Assertion failure - plugins and presets exist");
    }

    const ignored = yield* function* recurseDescriptors(config, pass) {
      const plugins = [];

      for (let i = 0; i < config.plugins.length; i++) {
        const descriptor = config.plugins[i];

        if (descriptor.options !== false) {
          try {
            plugins.push(yield* loadPluginDescriptor(descriptor, context));
          } catch (e) {
            if (i > 0 && e.code === "BABEL_UNKNOWN_PLUGIN_PROPERTY") {
              (0, _options.checkNoUnwrappedItemOptionPairs)(config.plugins[i - 1], descriptor, "plugin", i, e);
            }

            throw e;
          }
        }
      }

      const presets = [];

      for (let i = 0; i < config.presets.length; i++) {
        const descriptor = config.presets[i];

        if (descriptor.options !== false) {
          try {
            presets.push({
              preset: yield* loadPresetDescriptor(descriptor, context),
              pass: descriptor.ownPass ? [] : pass
            });
          } catch (e) {
            if (i > 0 && e.code === "BABEL_UNKNOWN_OPTION") {
              (0, _options.checkNoUnwrappedItemOptionPairs)(config.presets[i - 1], descriptor, "preset", i, e);
            }

            throw e;
          }
        }
      }

      if (presets.length > 0) {
        passes.splice(1, 0, ...presets.map(o => o.pass).filter(p => p !== pass));

        for (const {
          preset,
          pass
        } of presets) {
          if (!preset) return true;
          const ignored = yield* recurseDescriptors({
            plugins: preset.plugins,
            presets: preset.presets
          }, pass);
          if (ignored) return true;
          preset.options.forEach(opts => {
            (0, _util.mergeOptions)(optionDefaults, opts);
          });
        }
      }

      if (plugins.length > 0) {
        pass.unshift(...plugins);
      }
    }({
      plugins: plugins.map(item => {
        const desc = (0, _item.getItemDescriptor)(item);

        if (!desc) {
          throw new Error("Assertion failure - must be config item");
        }

        return desc;
      }),
      presets: presets.map(item => {
        const desc = (0, _item.getItemDescriptor)(item);

        if (!desc) {
          throw new Error("Assertion failure - must be config item");
        }

        return desc;
      })
    }, passes[0]);
    if (ignored) return null;
  } catch (e) {
    if (!/^\[BABEL\]/.test(e.message)) {
      e.message = `[BABEL] ${context.filename || "unknown"}: ${e.message}`;
    }

    throw e;
  }

  const opts = optionDefaults;
  (0, _util.mergeOptions)(opts, options);
  opts.plugins = passes[0];
  opts.presets = passes.slice(1).filter(plugins => plugins.length > 0).map(plugins => ({
    plugins
  }));
  opts.passPerPreset = opts.presets.length > 0;
  return {
    options: opts,
    passes: passes
  };
});

exports.default = _default;
const loadDescriptor = (0, _caching.makeWeakCache)(function* ({
  value,
  options,
  dirname,
  alias
}, cache) {
  if (options === false) throw new Error("Assertion failure");
  options = options || {};
  let item = value;

  if (typeof value === "function") {
    const api = Object.assign(Object.assign({}, context), (0, _configApi.default)(cache));

    try {
      item = value(api, options, dirname);
    } catch (e) {
      if (alias) {
        e.message += ` (While processing: ${JSON.stringify(alias)})`;
      }

      throw e;
    }
  }

  if (!item || typeof item !== "object") {
    throw new Error("Plugin/Preset did not return an object.");
  }

  if (typeof item.then === "function") {
    yield* [];
    throw new Error(`You appear to be using an async plugin, ` + `which your current version of Babel does not support. ` + `If you're using a published plugin, ` + `you may need to upgrade your @babel/core version.`);
  }

  return {
    value: item,
    options,
    dirname,
    alias
  };
});

function* loadPluginDescriptor(descriptor, context) {
  if (descriptor.value instanceof _plugin.default) {
    if (descriptor.options) {
      throw new Error("Passed options to an existing Plugin instance will not work.");
    }

    return descriptor.value;
  }

  return yield* instantiatePlugin(yield* loadDescriptor(descriptor, context), context);
}

const instantiatePlugin = (0, _caching.makeWeakCache)(function* ({
  value,
  options,
  dirname,
  alias
}, cache) {
  const pluginObj = (0, _plugins.validatePluginObject)(value);
  const plugin = Object.assign({}, pluginObj);

  if (plugin.visitor) {
    plugin.visitor = _traverse().default.explode(Object.assign({}, plugin.visitor));
  }

  if (plugin.inherits) {
    const inheritsDescriptor = {
      name: undefined,
      alias: `${alias}$inherits`,
      value: plugin.inherits,
      options,
      dirname
    };
    const inherits = yield* (0, _async.forwardAsync)(loadPluginDescriptor, run => {
      return cache.invalidate(data => run(inheritsDescriptor, data));
    });
    plugin.pre = chain(inherits.pre, plugin.pre);
    plugin.post = chain(inherits.post, plugin.post);
    plugin.manipulateOptions = chain(inherits.manipulateOptions, plugin.manipulateOptions);
    plugin.visitor = _traverse().default.visitors.merge([inherits.visitor || {}, plugin.visitor || {}]);
  }

  return new _plugin.default(plugin, options, alias);
});

const validateIfOptionNeedsFilename = (options, descriptor) => {
  if (options.test || options.include || options.exclude) {
    const formattedPresetName = descriptor.name ? `"${descriptor.name}"` : "/* your preset */";
    throw new Error([`Preset ${formattedPresetName} requires a filename to be set when babel is called directly,`, `\`\`\``, `babel.transform(code, { filename: 'file.ts', presets: [${formattedPresetName}] });`, `\`\`\``, `See https://babeljs.io/docs/en/options#filename for more information.`].join("\n"));
  }
};

const validatePreset = (preset, context, descriptor) => {
  if (!context.filename) {
    const {
      options
    } = preset;
    validateIfOptionNeedsFilename(options, descriptor);

    if (options.overrides) {
      options.overrides.forEach(overrideOptions => validateIfOptionNeedsFilename(overrideOptions, descriptor));
    }
  }
};

function* loadPresetDescriptor(descriptor, context) {
  const preset = instantiatePreset(yield* loadDescriptor(descriptor, context));
  validatePreset(preset, context, descriptor);
  return yield* (0, _configChain.buildPresetChain)(preset, context);
}

const instantiatePreset = (0, _caching.makeWeakCacheSync)(({
  value,
  dirname,
  alias
}) => {
  return {
    options: (0, _options.validate)("preset", value),
    alias,
    dirname
  };
});

function chain(a, b) {
  const fns = [a, b].filter(Boolean);
  if (fns.length <= 1) return fns[0];
  return function (...args) {
    for (const fn of fns) {
      fn.apply(this, args);
    }
  };
}