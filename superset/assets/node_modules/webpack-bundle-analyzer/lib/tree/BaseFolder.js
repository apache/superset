"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _lodash = _interopRequireDefault(require("lodash"));

var _Node = _interopRequireDefault(require("./Node"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class BaseFolder extends _Node.default {
  constructor(name, parent) {
    super(name, parent);
    this.children = Object.create(null);
  }

  get src() {
    if (!_lodash.default.has(this, '_src')) {
      this._src = this.walk((node, src) => src += node.src || '', '', false);
    }

    return this._src;
  }

  get size() {
    if (!_lodash.default.has(this, '_size')) {
      this._size = this.walk((node, size) => size + node.size, 0, false);
    }

    return this._size;
  }

  getChild(name) {
    return this.children[name];
  }

  addChildModule(module) {
    const {
      name
    } = module;
    const currentChild = this.children[name]; // For some reason we already have this node in children and it's a folder.

    if (currentChild && currentChild instanceof BaseFolder) return;

    if (currentChild) {
      // We already have this node in children and it's a module.
      // Merging it's data.
      currentChild.mergeData(module.data);
    } else {
      // Pushing new module
      module.parent = this;
      this.children[name] = module;
    }

    delete this._size;
    delete this._src;
  }

  addChildFolder(folder) {
    folder.parent = this;
    this.children[folder.name] = folder;
    delete this._size;
    delete this._src;
    return folder;
  }

  walk(walker, state = {}, deep = true) {
    let stopped = false;

    _lodash.default.each(this.children, child => {
      if (deep && child.walk) {
        state = child.walk(walker, state, stop);
      } else {
        state = walker(child, state, stop);
      }

      if (stopped) return false;
    });

    return state;

    function stop(finalState) {
      stopped = true;
      return finalState;
    }
  }

  mergeNestedFolders() {
    if (!this.isRoot) {
      let childNames;

      while ((childNames = Object.keys(this.children)).length === 1) {
        const childName = childNames[0];
        const onlyChild = this.children[childName];

        if (onlyChild instanceof this.constructor) {
          this.name += `/${onlyChild.name}`;
          this.children = onlyChild.children;
        } else {
          break;
        }
      }
    }

    this.walk(child => {
      child.parent = this;

      if (child.mergeNestedFolders) {
        child.mergeNestedFolders();
      }
    }, null, false);
  }

  toChartData() {
    return {
      label: this.name,
      path: this.path,
      statSize: this.size,
      groups: _lodash.default.invokeMap(this.children, 'toChartData')
    };
  }

}

exports.default = BaseFolder;
;