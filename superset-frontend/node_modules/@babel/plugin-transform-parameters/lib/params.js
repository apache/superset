"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = convertFunctionParams;

var _helperCallDelegate = _interopRequireDefault(require("@babel/helper-call-delegate"));

var _core = require("@babel/core");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const buildDefaultParam = (0, _core.template)(`
  let VARIABLE_NAME =
    arguments.length > ARGUMENT_KEY && arguments[ARGUMENT_KEY] !== undefined ?
      arguments[ARGUMENT_KEY]
    :
      DEFAULT_VALUE;
`);
const buildLooseDefaultParam = (0, _core.template)(`
  if (ASSIGNMENT_IDENTIFIER === UNDEFINED) {
    ASSIGNMENT_IDENTIFIER = DEFAULT_VALUE;
  }
`);
const buildLooseDestructuredDefaultParam = (0, _core.template)(`
  let ASSIGNMENT_IDENTIFIER = PARAMETER_NAME === UNDEFINED ? DEFAULT_VALUE : PARAMETER_NAME ;
`);
const buildSafeArgumentsAccess = (0, _core.template)(`
  let $0 = arguments.length > $1 ? arguments[$1] : undefined;
`);

function isSafeBinding(scope, node) {
  if (!scope.hasOwnBinding(node.name)) return true;
  const {
    kind
  } = scope.getOwnBinding(node.name);
  return kind === "param" || kind === "local";
}

const iifeVisitor = {
  ReferencedIdentifier(path, state) {
    const {
      scope,
      node
    } = path;

    if (node.name === "eval" || !isSafeBinding(scope, node) || !isSafeBinding(state.scope, node)) {
      state.iife = true;
      path.stop();
    }
  },

  Scope(path) {
    path.skip();
  }

};

function convertFunctionParams(path, loose) {
  const {
    node,
    scope
  } = path;
  const state = {
    iife: false,
    scope: scope
  };
  const body = [];
  const params = path.get("params");
  let firstOptionalIndex = null;

  for (let i = 0; i < params.length; i++) {
    const param = params[i];

    for (const name of Object.keys(param.getBindingIdentifiers())) {
      var _scope$bindings$name;

      const constantViolations = (_scope$bindings$name = scope.bindings[name]) == null ? void 0 : _scope$bindings$name.constantViolations;

      if (constantViolations) {
        for (const redeclarator of constantViolations) {
          const node = redeclarator.node;

          switch (node.type) {
            case "VariableDeclarator":
              if (node.init === null) {
                const declaration = redeclarator.parentPath;

                if (!declaration.parentPath.isFor() || declaration.parentPath.get("body") === declaration) {
                  redeclarator.remove();
                  break;
                }
              }

            case "FunctionDeclaration":
              state.iife = true;
              break;
          }
        }
      }
    }

    const paramIsAssignmentPattern = param.isAssignmentPattern();

    if (paramIsAssignmentPattern && (loose || node.kind === "set")) {
      const left = param.get("left");
      const right = param.get("right");
      const undefinedNode = scope.buildUndefinedNode();

      if (left.isIdentifier()) {
        body.push(buildLooseDefaultParam({
          ASSIGNMENT_IDENTIFIER: _core.types.cloneNode(left.node),
          DEFAULT_VALUE: right.node,
          UNDEFINED: undefinedNode
        }));
        param.replaceWith(left.node);
      } else if (left.isObjectPattern() || left.isArrayPattern()) {
        const paramName = scope.generateUidIdentifier();
        body.push(buildLooseDestructuredDefaultParam({
          ASSIGNMENT_IDENTIFIER: left.node,
          DEFAULT_VALUE: right.node,
          PARAMETER_NAME: _core.types.cloneNode(paramName),
          UNDEFINED: undefinedNode
        }));
        param.replaceWith(paramName);
      }
    } else if (paramIsAssignmentPattern) {
      if (firstOptionalIndex === null) firstOptionalIndex = i;
      const left = param.get("left");
      const right = param.get("right");

      if (!state.iife) {
        if (right.isIdentifier() && !isSafeBinding(scope, right.node)) {
          state.iife = true;
        } else {
          right.traverse(iifeVisitor, state);
        }
      }

      const defNode = buildDefaultParam({
        VARIABLE_NAME: left.node,
        DEFAULT_VALUE: right.node,
        ARGUMENT_KEY: _core.types.numericLiteral(i)
      });
      body.push(defNode);
    } else if (firstOptionalIndex !== null) {
      const defNode = buildSafeArgumentsAccess([param.node, _core.types.numericLiteral(i)]);
      body.push(defNode);
    } else if (param.isObjectPattern() || param.isArrayPattern()) {
      const uid = path.scope.generateUidIdentifier("ref");

      const defNode = _core.types.variableDeclaration("let", [_core.types.variableDeclarator(param.node, uid)]);

      body.push(defNode);
      param.replaceWith(_core.types.cloneNode(uid));
    }

    if (!state.iife && !param.isIdentifier()) {
      param.traverse(iifeVisitor, state);
    }
  }

  if (body.length === 0) return false;

  if (firstOptionalIndex !== null) {
    node.params = node.params.slice(0, firstOptionalIndex);
  }

  path.ensureBlock();

  if (state.iife) {
    body.push((0, _helperCallDelegate.default)(path, scope, false));
    path.set("body", _core.types.blockStatement(body));
  } else {
    path.get("body").unshiftContainer("body", body);
  }

  return true;
}