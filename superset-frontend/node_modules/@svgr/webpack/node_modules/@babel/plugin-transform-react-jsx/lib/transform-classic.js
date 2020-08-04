"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _helperPluginUtils = require("@babel/helper-plugin-utils");

var _pluginSyntaxJsx = _interopRequireDefault(require("@babel/plugin-syntax-jsx"));

var _helperBuilderReactJsx = _interopRequireDefault(require("@babel/helper-builder-react-jsx"));

var _core = require("@babel/core");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const DEFAULT = {
  pragma: "React.createElement",
  pragmaFrag: "React.Fragment"
};

var _default = (0, _helperPluginUtils.declare)((api, options) => {
  const THROW_IF_NAMESPACE = options.throwIfNamespace === undefined ? true : !!options.throwIfNamespace;
  const PRAGMA_DEFAULT = options.pragma || DEFAULT.pragma;
  const PRAGMA_FRAG_DEFAULT = options.pragmaFrag || DEFAULT.pragmaFrag;
  const PURE_ANNOTATION = options.pure;
  const JSX_ANNOTATION_REGEX = /\*?\s*@jsx\s+([^\s]+)/;
  const JSX_FRAG_ANNOTATION_REGEX = /\*?\s*@jsxFrag\s+([^\s]+)/;

  const createIdentifierParser = id => () => {
    return id.split(".").map(name => _core.types.identifier(name)).reduce((object, property) => _core.types.memberExpression(object, property));
  };

  const visitor = (0, _helperBuilderReactJsx.default)({
    pre(state) {
      const tagName = state.tagName;
      const args = state.args;

      if (_core.types.react.isCompatTag(tagName)) {
        args.push(_core.types.stringLiteral(tagName));
      } else {
        args.push(state.tagExpr);
      }
    },

    post(state, pass) {
      state.callee = pass.get("jsxIdentifier")();
      state.pure = PURE_ANNOTATION != null ? PURE_ANNOTATION : pass.get("pragma") === DEFAULT.pragma;
    },

    throwIfNamespace: THROW_IF_NAMESPACE
  });
  visitor.Program = {
    enter(path, state) {
      const {
        file
      } = state;
      let pragma = PRAGMA_DEFAULT;
      let pragmaFrag = PRAGMA_FRAG_DEFAULT;
      let pragmaSet = !!options.pragma;
      let pragmaFragSet = !!options.pragma;

      if (file.ast.comments) {
        for (const comment of file.ast.comments) {
          const jsxMatches = JSX_ANNOTATION_REGEX.exec(comment.value);

          if (jsxMatches) {
            pragma = jsxMatches[1];
            pragmaSet = true;
          }

          const jsxFragMatches = JSX_FRAG_ANNOTATION_REGEX.exec(comment.value);

          if (jsxFragMatches) {
            pragmaFrag = jsxFragMatches[1];
            pragmaFragSet = true;
          }
        }
      }

      state.set("jsxIdentifier", createIdentifierParser(pragma));
      state.set("jsxFragIdentifier", createIdentifierParser(pragmaFrag));
      state.set("usedFragment", false);
      state.set("pragma", pragma);
      state.set("pragmaSet", pragmaSet);
      state.set("pragmaFragSet", pragmaFragSet);
    },

    exit(path, state) {
      if (state.get("pragmaSet") && state.get("usedFragment") && !state.get("pragmaFragSet")) {
        throw new Error("transform-react-jsx: pragma has been set but " + "pragmaFrag has not been set");
      }
    }

  };

  visitor.JSXAttribute = function (path) {
    if (_core.types.isJSXElement(path.node.value)) {
      path.node.value = _core.types.jsxExpressionContainer(path.node.value);
    }
  };

  return {
    name: "transform-react-jsx",
    inherits: _pluginSyntaxJsx.default,
    visitor
  };
});

exports.default = _default;