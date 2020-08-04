"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.Scope = void 0;

var _scopeflags = require("./scopeflags");

var N = _interopRequireWildcard(require("../types"));

var _location = require("../parser/location");

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

class Scope {
  constructor(flags) {
    this.var = [];
    this.lexical = [];
    this.functions = [];
    this.flags = flags;
  }

}

exports.Scope = Scope;

class ScopeHandler {
  constructor(raise, inModule) {
    this.scopeStack = [];
    this.undefinedExports = new Map();
    this.undefinedPrivateNames = new Map();
    this.raise = raise;
    this.inModule = inModule;
  }

  get inFunction() {
    return (this.currentVarScope().flags & _scopeflags.SCOPE_FUNCTION) > 0;
  }

  get allowSuper() {
    return (this.currentThisScope().flags & _scopeflags.SCOPE_SUPER) > 0;
  }

  get allowDirectSuper() {
    return (this.currentThisScope().flags & _scopeflags.SCOPE_DIRECT_SUPER) > 0;
  }

  get inClass() {
    return (this.currentThisScope().flags & _scopeflags.SCOPE_CLASS) > 0;
  }

  get inNonArrowFunction() {
    return (this.currentThisScope().flags & _scopeflags.SCOPE_FUNCTION) > 0;
  }

  get treatFunctionsAsVar() {
    return this.treatFunctionsAsVarInScope(this.currentScope());
  }

  createScope(flags) {
    return new Scope(flags);
  }

  enter(flags) {
    this.scopeStack.push(this.createScope(flags));
  }

  exit() {
    this.scopeStack.pop();
  }

  treatFunctionsAsVarInScope(scope) {
    return !!(scope.flags & _scopeflags.SCOPE_FUNCTION || !this.inModule && scope.flags & _scopeflags.SCOPE_PROGRAM);
  }

  declareName(name, bindingType, pos) {
    let scope = this.currentScope();

    if (bindingType & _scopeflags.BIND_SCOPE_LEXICAL || bindingType & _scopeflags.BIND_SCOPE_FUNCTION) {
      this.checkRedeclarationInScope(scope, name, bindingType, pos);

      if (bindingType & _scopeflags.BIND_SCOPE_FUNCTION) {
        scope.functions.push(name);
      } else {
        scope.lexical.push(name);
      }

      if (bindingType & _scopeflags.BIND_SCOPE_LEXICAL) {
        this.maybeExportDefined(scope, name);
      }
    } else if (bindingType & _scopeflags.BIND_SCOPE_VAR) {
      for (let i = this.scopeStack.length - 1; i >= 0; --i) {
        scope = this.scopeStack[i];
        this.checkRedeclarationInScope(scope, name, bindingType, pos);
        scope.var.push(name);
        this.maybeExportDefined(scope, name);
        if (scope.flags & _scopeflags.SCOPE_VAR) break;
      }
    }

    if (this.inModule && scope.flags & _scopeflags.SCOPE_PROGRAM) {
      this.undefinedExports.delete(name);
    }
  }

  maybeExportDefined(scope, name) {
    if (this.inModule && scope.flags & _scopeflags.SCOPE_PROGRAM) {
      this.undefinedExports.delete(name);
    }
  }

  checkRedeclarationInScope(scope, name, bindingType, pos) {
    if (this.isRedeclaredInScope(scope, name, bindingType)) {
      this.raise(pos, _location.Errors.VarRedeclaration, name);
    }
  }

  isRedeclaredInScope(scope, name, bindingType) {
    if (!(bindingType & _scopeflags.BIND_KIND_VALUE)) return false;

    if (bindingType & _scopeflags.BIND_SCOPE_LEXICAL) {
      return scope.lexical.indexOf(name) > -1 || scope.functions.indexOf(name) > -1 || scope.var.indexOf(name) > -1;
    }

    if (bindingType & _scopeflags.BIND_SCOPE_FUNCTION) {
      return scope.lexical.indexOf(name) > -1 || !this.treatFunctionsAsVarInScope(scope) && scope.var.indexOf(name) > -1;
    }

    return scope.lexical.indexOf(name) > -1 && !(scope.flags & _scopeflags.SCOPE_SIMPLE_CATCH && scope.lexical[0] === name) || !this.treatFunctionsAsVarInScope(scope) && scope.functions.indexOf(name) > -1;
  }

  checkLocalExport(id) {
    if (this.scopeStack[0].lexical.indexOf(id.name) === -1 && this.scopeStack[0].var.indexOf(id.name) === -1 && this.scopeStack[0].functions.indexOf(id.name) === -1) {
      this.undefinedExports.set(id.name, id.start);
    }
  }

  currentScope() {
    return this.scopeStack[this.scopeStack.length - 1];
  }

  currentVarScope() {
    for (let i = this.scopeStack.length - 1;; i--) {
      const scope = this.scopeStack[i];

      if (scope.flags & _scopeflags.SCOPE_VAR) {
        return scope;
      }
    }
  }

  currentThisScope() {
    for (let i = this.scopeStack.length - 1;; i--) {
      const scope = this.scopeStack[i];

      if ((scope.flags & _scopeflags.SCOPE_VAR || scope.flags & _scopeflags.SCOPE_CLASS) && !(scope.flags & _scopeflags.SCOPE_ARROW)) {
        return scope;
      }
    }
  }

}

exports.default = ScopeHandler;