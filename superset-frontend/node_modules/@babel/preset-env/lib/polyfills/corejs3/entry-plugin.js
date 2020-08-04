"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _data = _interopRequireDefault(require("core-js-compat/data"));

var _entries = _interopRequireDefault(require("core-js-compat/entries"));

var _getModulesListForTargetVersion = _interopRequireDefault(require("core-js-compat/get-modules-list-for-target-version"));

var _helperCompilationTargets = require("@babel/helper-compilation-targets");

var _utils = require("../../utils");

var _debug = require("../../debug");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function isBabelPolyfillSource(source) {
  return source === "@babel/polyfill" || source === "babel-polyfill";
}

function isCoreJSSource(source) {
  if (typeof source === "string") {
    source = source.replace(/\\/g, "/").replace(/(\/(index)?)?(\.js)?$/i, "").toLowerCase();
  }

  return (0, _utils.has)(_entries.default, source) && _entries.default[source];
}

const BABEL_POLYFILL_DEPRECATION = `
  \`@babel/polyfill\` is deprecated. Please, use required parts of \`core-js\`
  and \`regenerator-runtime/runtime\` separately`;

function _default(_, {
  corejs,
  include,
  exclude,
  polyfillTargets,
  debug
}) {
  const polyfills = (0, _helperCompilationTargets.filterItems)(_data.default, include, exclude, polyfillTargets, null);
  const available = new Set((0, _getModulesListForTargetVersion.default)(corejs.version));

  function shouldReplace(source, modules) {
    if (!modules) return false;

    if (modules.length === 1 && polyfills.has(modules[0]) && available.has(modules[0]) && (0, _utils.getModulePath)(modules[0]) === source) {
      return false;
    }

    return true;
  }

  const isPolyfillImport = {
    ImportDeclaration(path) {
      const source = (0, _utils.getImportSource)(path);
      if (!source) return;

      if (isBabelPolyfillSource(source)) {
        console.warn(BABEL_POLYFILL_DEPRECATION);
      } else {
        const modules = isCoreJSSource(source);

        if (shouldReplace(source, modules)) {
          this.replaceBySeparateModulesImport(path, modules);
        }
      }
    },

    Program: {
      enter(path) {
        path.get("body").forEach(bodyPath => {
          const source = (0, _utils.getRequireSource)(bodyPath);
          if (!source) return;

          if (isBabelPolyfillSource(source)) {
            console.warn(BABEL_POLYFILL_DEPRECATION);
          } else {
            const modules = isCoreJSSource(source);

            if (shouldReplace(source, modules)) {
              this.replaceBySeparateModulesImport(bodyPath, modules);
            }
          }
        });
      },

      exit(path) {
        const filtered = (0, _utils.intersection)(polyfills, this.polyfillsSet, available);
        const reversed = Array.from(filtered).reverse();

        for (const module of reversed) {
          if (!this.injectedPolyfills.has(module)) {
            (0, _utils.createImport)(path, module);
          }
        }

        filtered.forEach(module => this.injectedPolyfills.add(module));
      }

    }
  };
  return {
    name: "corejs3-entry",
    visitor: isPolyfillImport,

    pre() {
      this.injectedPolyfills = new Set();
      this.polyfillsSet = new Set();

      this.replaceBySeparateModulesImport = function (path, modules) {
        for (const module of modules) {
          this.polyfillsSet.add(module);
        }

        path.remove();
      };
    },

    post() {
      if (debug) {
        (0, _debug.logEntryPolyfills)("core-js", this.injectedPolyfills.size > 0, this.injectedPolyfills, this.file.opts.filename, polyfillTargets, _data.default);
      }
    }

  };
}