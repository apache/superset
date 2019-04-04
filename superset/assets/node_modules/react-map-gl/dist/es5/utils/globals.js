"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.document = exports.global = exports.window = void 0;

/* global window, global, document */
var window_ = typeof window !== 'undefined' ? window : global;
exports.window = window_;
var global_ = typeof global !== 'undefined' ? global : window;
exports.global = global_;
var document_ = typeof document !== 'undefined' ? document : {};
exports.document = document_;
//# sourceMappingURL=globals.js.map