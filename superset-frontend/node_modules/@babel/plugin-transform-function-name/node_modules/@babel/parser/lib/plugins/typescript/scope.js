"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _scope = _interopRequireWildcard(require("../../util/scope"));

var _scopeflags = require("../../util/scopeflags");

var N = _interopRequireWildcard(require("../../types"));

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

class TypeScriptScope extends _scope.Scope {
  constructor(...args) {
    super(...args);
    this.types = [];
    this.enums = [];
    this.constEnums = [];
    this.classes = [];
    this.exportOnlyBindings = [];
  }

}

class TypeScriptScopeHandler extends _scope.default {
  createScope(flags) {
    return new TypeScriptScope(flags);
  }

  declareName(name, bindingType, pos) {
    const scope = this.currentScope();

    if (bindingType & _scopeflags.BIND_FLAGS_TS_EXPORT_ONLY) {
      this.maybeExportDefined(scope, name);
      scope.exportOnlyBindings.push(name);
      return;
    }

    super.declareName(...arguments);

    if (bindingType & _scopeflags.BIND_KIND_TYPE) {
      if (!(bindingType & _scopeflags.BIND_KIND_VALUE)) {
        this.checkRedeclarationInScope(scope, name, bindingType, pos);
        this.maybeExportDefined(scope, name);
      }

      scope.types.push(name);
    }

    if (bindingType & _scopeflags.BIND_FLAGS_TS_ENUM) scope.enums.push(name);
    if (bindingType & _scopeflags.BIND_FLAGS_TS_CONST_ENUM) scope.constEnums.push(name);
    if (bindingType & _scopeflags.BIND_FLAGS_CLASS) scope.classes.push(name);
  }

  isRedeclaredInScope(scope, name, bindingType) {
    if (scope.enums.indexOf(name) > -1) {
      if (bindingType & _scopeflags.BIND_FLAGS_TS_ENUM) {
        const isConst = !!(bindingType & _scopeflags.BIND_FLAGS_TS_CONST_ENUM);
        const wasConst = scope.constEnums.indexOf(name) > -1;
        return isConst !== wasConst;
      }

      return true;
    }

    if (bindingType & _scopeflags.BIND_FLAGS_CLASS && scope.classes.indexOf(name) > -1) {
      if (scope.lexical.indexOf(name) > -1) {
        return !!(bindingType & _scopeflags.BIND_KIND_VALUE);
      } else {
        return false;
      }
    }

    if (bindingType & _scopeflags.BIND_KIND_TYPE && scope.types.indexOf(name) > -1) {
      return true;
    }

    return super.isRedeclaredInScope(...arguments);
  }

  checkLocalExport(id) {
    if (this.scopeStack[0].types.indexOf(id.name) === -1 && this.scopeStack[0].exportOnlyBindings.indexOf(id.name) === -1) {
      super.checkLocalExport(id);
    }
  }

}

exports.default = TypeScriptScopeHandler;