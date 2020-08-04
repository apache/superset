"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

class BaseParser {
  constructor() {
    this.sawUnambiguousESM = false;
    this.ambiguousScriptDifferentAst = false;
  }

  hasPlugin(name) {
    return this.plugins.has(name);
  }

  getPluginOption(plugin, name) {
    if (this.hasPlugin(plugin)) return this.plugins.get(plugin)[name];
  }

}

exports.default = BaseParser;