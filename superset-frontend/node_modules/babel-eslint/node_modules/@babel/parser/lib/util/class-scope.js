"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.ClassScope = void 0;

var _scopeflags = require("./scopeflags");

var _location = require("../parser/location");

class ClassScope {
  constructor() {
    this.privateNames = new Set();
    this.loneAccessors = new Map();
    this.undefinedPrivateNames = new Map();
  }

}

exports.ClassScope = ClassScope;

class ClassScopeHandler {
  constructor(raise) {
    this.stack = [];
    this.undefinedPrivateNames = new Map();
    this.raise = raise;
  }

  current() {
    return this.stack[this.stack.length - 1];
  }

  enter() {
    this.stack.push(new ClassScope());
  }

  exit() {
    const oldClassScope = this.stack.pop();
    const current = this.current();

    for (let _i = 0, _Array$from = Array.from(oldClassScope.undefinedPrivateNames); _i < _Array$from.length; _i++) {
      const [name, pos] = _Array$from[_i];

      if (current) {
        if (!current.undefinedPrivateNames.has(name)) {
          current.undefinedPrivateNames.set(name, pos);
        }
      } else {
        this.raise(pos, _location.Errors.InvalidPrivateFieldResolution, name);
      }
    }
  }

  declarePrivateName(name, elementType, pos) {
    const classScope = this.current();
    let redefined = classScope.privateNames.has(name);

    if (elementType & _scopeflags.CLASS_ELEMENT_KIND_ACCESSOR) {
      const accessor = redefined && classScope.loneAccessors.get(name);

      if (accessor) {
        const oldStatic = accessor & _scopeflags.CLASS_ELEMENT_FLAG_STATIC;
        const newStatic = elementType & _scopeflags.CLASS_ELEMENT_FLAG_STATIC;
        const oldKind = accessor & _scopeflags.CLASS_ELEMENT_KIND_ACCESSOR;
        const newKind = elementType & _scopeflags.CLASS_ELEMENT_KIND_ACCESSOR;
        redefined = oldKind === newKind || oldStatic !== newStatic;
        if (!redefined) classScope.loneAccessors.delete(name);
      } else if (!redefined) {
        classScope.loneAccessors.set(name, elementType);
      }
    }

    if (redefined) {
      this.raise(pos, _location.Errors.PrivateNameRedeclaration, name);
    }

    classScope.privateNames.add(name);
    classScope.undefinedPrivateNames.delete(name);
  }

  usePrivateName(name, pos) {
    let classScope;

    for (let _i2 = 0, _this$stack = this.stack; _i2 < _this$stack.length; _i2++) {
      classScope = _this$stack[_i2];
      if (classScope.privateNames.has(name)) return;
    }

    if (classScope) {
      classScope.undefinedPrivateNames.set(name, pos);
    } else {
      this.raise(pos, _location.Errors.InvalidPrivateFieldResolution, name);
    }
  }

}

exports.default = ClassScopeHandler;