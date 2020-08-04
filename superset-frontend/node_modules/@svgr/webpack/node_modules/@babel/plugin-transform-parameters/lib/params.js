"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = convertFunctionParams;

var _core = require("@babel/core");

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
const iifeVisitor = {
  "ReferencedIdentifier|BindingIdentifier"(path, state) {
    const {
      scope,
      node
    } = path;
    const {
      name
    } = node;

    if (name === "eval" || scope.getBinding(name) === state.scope.parent.getBinding(name) && state.scope.hasOwnBinding(name)) {
      state.needsOuterBinding = true;
      path.stop();
    }
  },

  "TypeAnnotation|TSTypeAnnotation|TypeParameterDeclaration|TSTypeParameterDeclaration": path => path.skip()
};

function convertFunctionParams(path, loose, shouldTransformParam, replaceRestElement) {
  const params = path.get("params");
  const isSimpleParameterList = params.every(param => param.isIdentifier());
  if (isSimpleParameterList) return false;
  const {
    node,
    scope
  } = path;
  const state = {
    stop: false,
    needsOuterBinding: false,
    scope
  };
  const body = [];
  const shadowedParams = new Set();

  for (const param of params) {
    for (const name of Object.keys(param.getBindingIdentifiers())) {
      var _scope$bindings$name;

      const constantViolations = (_scope$bindings$name = scope.bindings[name]) == null ? void 0 : _scope$bindings$name.constantViolations;

      if (constantViolations) {
        for (const redeclarator of constantViolations) {
          const node = redeclarator.node;

          switch (node.type) {
            case "VariableDeclarator":
              {
                if (node.init === null) {
                  const declaration = redeclarator.parentPath;

                  if (!declaration.parentPath.isFor() || declaration.parentPath.get("body") === declaration) {
                    redeclarator.remove();
                    break;
                  }
                }

                shadowedParams.add(name);
                break;
              }

            case "FunctionDeclaration":
              shadowedParams.add(name);
              break;
          }
        }
      }
    }
  }

  if (shadowedParams.size === 0) {
    for (const param of params) {
      if (!param.isIdentifier()) param.traverse(iifeVisitor, state);
      if (state.needsOuterBinding) break;
    }
  }

  let firstOptionalIndex = null;

  for (let i = 0; i < params.length; i++) {
    const param = params[i];

    if (shouldTransformParam && !shouldTransformParam(i)) {
      continue;
    }

    const transformedRestNodes = [];

    if (replaceRestElement) {
      replaceRestElement(param.parentPath, param, transformedRestNodes);
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

    if (transformedRestNodes) {
      for (const transformedNode of transformedRestNodes) {
        body.push(transformedNode);
      }
    }
  }

  if (firstOptionalIndex !== null) {
    node.params = node.params.slice(0, firstOptionalIndex);
  }

  path.ensureBlock();

  if (state.needsOuterBinding || shadowedParams.size > 0) {
    body.push(buildScopeIIFE(shadowedParams, path.get("body").node));
    path.set("body", _core.types.blockStatement(body));
    const bodyPath = path.get("body.body");
    const arrowPath = bodyPath[bodyPath.length - 1].get("argument.callee");
    arrowPath.arrowFunctionToExpression();
    arrowPath.node.generator = path.node.generator;
    arrowPath.node.async = path.node.async;
    path.node.generator = false;
  } else {
    path.get("body").unshiftContainer("body", body);
  }

  return true;
}

function buildScopeIIFE(shadowedParams, body) {
  const args = [];
  const params = [];

  for (const name of shadowedParams) {
    args.push(_core.types.identifier(name));
    params.push(_core.types.identifier(name));
  }

  return _core.types.returnStatement(_core.types.callExpression(_core.types.arrowFunctionExpression(params, body), params));
}