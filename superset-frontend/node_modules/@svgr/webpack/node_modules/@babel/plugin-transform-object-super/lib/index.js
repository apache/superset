"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _helperPluginUtils = require("@babel/helper-plugin-utils");

var _helperReplaceSupers = _interopRequireDefault(require("@babel/helper-replace-supers"));

var _core = require("@babel/core");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function replacePropertySuper(path, getObjectRef, file) {
  const replaceSupers = new _helperReplaceSupers.default({
    getObjectRef: getObjectRef,
    methodPath: path,
    file: file
  });
  replaceSupers.replace();
}

var _default = (0, _helperPluginUtils.declare)(api => {
  api.assertVersion(7);
  return {
    name: "transform-object-super",
    visitor: {
      ObjectExpression(path, state) {
        let objectRef;

        const getObjectRef = () => objectRef = objectRef || path.scope.generateUidIdentifier("obj");

        path.get("properties").forEach(propPath => {
          if (!propPath.isMethod()) return;
          replacePropertySuper(propPath, getObjectRef, state);
        });

        if (objectRef) {
          path.scope.push({
            id: _core.types.cloneNode(objectRef)
          });
          path.replaceWith(_core.types.assignmentExpression("=", _core.types.cloneNode(objectRef), path.node));
        }
      }

    }
  };
});

exports.default = _default;