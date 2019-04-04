"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _debug = require("./debug");

var _utils = require("./utils");

function _default({
  types: t
}) {
  function replaceWithPolyfillImports(path, polyfills, regenerator) {
    if (regenerator) {
      (0, _utils.createImport)(path, "regenerator-runtime");
    }

    const items = Array.isArray(polyfills) ? new Set(polyfills) : polyfills;

    for (const p of Array.from(items).reverse()) {
      (0, _utils.createImport)(path, p);
    }

    path.remove();
  }

  const isPolyfillImport = {
    ImportDeclaration(path, state) {
      if (path.node.specifiers.length === 0 && (0, _utils.isPolyfillSource)(path.node.source.value)) {
        this.importPolyfillIncluded = true;
        replaceWithPolyfillImports(path, state.opts.polyfills, state.opts.regenerator);
      }
    },

    Program(path, state) {
      path.get("body").forEach(bodyPath => {
        if ((0, _utils.isRequire)(t, bodyPath)) {
          replaceWithPolyfillImports(bodyPath, state.opts.polyfills, state.opts.regenerator);
        }
      });
    }

  };
  return {
    name: "transform-polyfill-require",
    visitor: isPolyfillImport,

    pre() {
      this.numPolyfillImports = 0;
      this.importPolyfillIncluded = false;
    },

    post() {
      const {
        debug,
        onDebug,
        polyfills
      } = this.opts;

      if (debug) {
        (0, _debug.logEntryPolyfills)(this.importPolyfillIncluded, polyfills, this.file.opts.filename, onDebug);
      }
    }

  };
}