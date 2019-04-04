/**
 * Copyright (c) 2014-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
"use strict";

var _assert = _interopRequireDefault(require("assert"));

var _hoist = require("./hoist");

var _emit = require("./emit");

var _replaceShorthandObjectMethod = _interopRequireDefault(require("./replaceShorthandObjectMethod"));

var util = _interopRequireWildcard(require("./util"));

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.getVisitor = function (_ref) {
  var t = _ref.types;
  return {
    Function: {
      exit: util.wrapWithTypes(t, function (path, state) {
        var node = path.node;

        if (node.generator) {
          if (node.async) {
            // Async generator
            if (state.opts.asyncGenerators === false) return;
          } else {
            // Plain generator
            if (state.opts.generators === false) return;
          }
        } else if (node.async) {
          // Async function
          if (state.opts.async === false) return;
        } else {
          // Not a generator or async function.
          return;
        } // if this is an ObjectMethod, we need to convert it to an ObjectProperty


        path = (0, _replaceShorthandObjectMethod.default)(path);
        node = path.node;
        var contextId = path.scope.generateUidIdentifier("context");
        var argsId = path.scope.generateUidIdentifier("args");
        path.ensureBlock();
        var bodyBlockPath = path.get("body");

        if (node.async) {
          bodyBlockPath.traverse(awaitVisitor);
        }

        bodyBlockPath.traverse(functionSentVisitor, {
          context: contextId
        });
        var outerBody = [];
        var innerBody = [];
        bodyBlockPath.get("body").forEach(function (childPath) {
          var node = childPath.node;

          if (t.isExpressionStatement(node) && t.isStringLiteral(node.expression)) {
            // Babylon represents directives like "use strict" as elements
            // of a bodyBlockPath.node.directives array, but they could just
            // as easily be represented (by other parsers) as traditional
            // string-literal-valued expression statements, so we need to
            // handle that here. (#248)
            outerBody.push(node);
          } else if (node && node._blockHoist != null) {
            outerBody.push(node);
          } else {
            innerBody.push(node);
          }
        });

        if (outerBody.length > 0) {
          // Only replace the inner body if we actually hoisted any statements
          // to the outer body.
          bodyBlockPath.node.body = innerBody;
        }

        var outerFnExpr = getOuterFnExpr(path); // Note that getOuterFnExpr has the side-effect of ensuring that the
        // function has a name (so node.id will always be an Identifier), even
        // if a temporary name has to be synthesized.

        t.assertIdentifier(node.id);
        var innerFnId = t.identifier(node.id.name + "$"); // Turn all declarations into vars, and replace the original
        // declarations with equivalent assignment expressions.

        var vars = (0, _hoist.hoist)(path);
        var didRenameArguments = renameArguments(path, function () {
          return t.clone(argsId);
        });

        if (didRenameArguments) {
          vars = vars || t.variableDeclaration("var", []);
          var argumentIdentifier = t.identifier("arguments"); // we need to do this as otherwise arguments in arrow functions gets hoisted

          argumentIdentifier._shadowedFunctionLiteral = path;
          vars.declarations.push(t.variableDeclarator(t.clone(argsId), argumentIdentifier));
        }

        var emitter = new _emit.Emitter(contextId);
        emitter.explode(path.get("body"));

        if (vars && vars.declarations.length > 0) {
          outerBody.push(vars);
        }

        var wrapArgs = [emitter.getContextFunction(innerFnId), // Async functions that are not generators don't care about the
        // outer function because they don't need it to be marked and don't
        // inherit from its .prototype.
        node.generator ? outerFnExpr : t.nullLiteral(), t.thisExpression()];
        var tryLocsList = emitter.getTryLocsList();

        if (tryLocsList) {
          wrapArgs.push(tryLocsList);
        }

        var wrapCall = t.callExpression(util.runtimeProperty(node.async ? "async" : "wrap"), wrapArgs);
        outerBody.push(t.returnStatement(wrapCall));
        node.body = t.blockStatement(outerBody);
        var oldDirectives = bodyBlockPath.node.directives;

        if (oldDirectives) {
          // Babylon represents directives like "use strict" as elements of
          // a bodyBlockPath.node.directives array. (#248)
          node.body.directives = oldDirectives;
        }

        var wasGeneratorFunction = node.generator;

        if (wasGeneratorFunction) {
          node.generator = false;
        }

        if (node.async) {
          node.async = false;
        }

        if (wasGeneratorFunction && t.isExpression(node)) {
          util.replaceWithOrRemove(path, t.callExpression(util.runtimeProperty("mark"), [node]));
          path.addComment("leading", "#__PURE__");
        }

        var insertedLocs = emitter.getInsertedLocs();
        path.traverse({
          NumericLiteral: function NumericLiteral(path) {
            if (!insertedLocs.has(path.node)) {
              return;
            }

            path.replaceWith(t.numericLiteral(path.node.value));
          }
        }); // Generators are processed in 'exit' handlers so that regenerator only has to run on
        // an ES5 AST, but that means traversal will not pick up newly inserted references
        // to things like 'regeneratorRuntime'. To avoid this, we explicitly requeue.

        path.requeue();
      })
    }
  };
}; // Given a NodePath for a Function, return an Expression node that can be
// used to refer reliably to the function object from inside the function.
// This expression is essentially a replacement for arguments.callee, with
// the key advantage that it works in strict mode.


function getOuterFnExpr(funPath) {
  var t = util.getTypes();
  var node = funPath.node;
  t.assertFunction(node);

  if (!node.id) {
    // Default-exported function declarations, and function expressions may not
    // have a name to reference, so we explicitly add one.
    node.id = funPath.scope.parent.generateUidIdentifier("callee");
  }

  if (node.generator && // Non-generator functions don't need to be marked.
  t.isFunctionDeclaration(node)) {
    // Return the identifier returned by runtime.mark(<node.id>).
    return getMarkedFunctionId(funPath);
  }

  return t.clone(node.id);
}

var getMarkInfo = require("private").makeAccessor();

function getMarkedFunctionId(funPath) {
  var t = util.getTypes();
  var node = funPath.node;
  t.assertIdentifier(node.id);
  var blockPath = funPath.findParent(function (path) {
    return path.isProgram() || path.isBlockStatement();
  });

  if (!blockPath) {
    return node.id;
  }

  var block = blockPath.node;

  _assert.default.ok(Array.isArray(block.body));

  var info = getMarkInfo(block);

  if (!info.decl) {
    info.decl = t.variableDeclaration("var", []);
    blockPath.unshiftContainer("body", info.decl);
    info.declPath = blockPath.get("body.0");
  }

  _assert.default.strictEqual(info.declPath.node, info.decl); // Get a new unique identifier for our marked variable.


  var markedId = blockPath.scope.generateUidIdentifier("marked");
  var markCallExp = t.callExpression(util.runtimeProperty("mark"), [t.clone(node.id)]);
  var index = info.decl.declarations.push(t.variableDeclarator(markedId, markCallExp)) - 1;
  var markCallExpPath = info.declPath.get("declarations." + index + ".init");

  _assert.default.strictEqual(markCallExpPath.node, markCallExp);

  markCallExpPath.addComment("leading", "#__PURE__");
  return t.clone(markedId);
}

function renameArguments(funcPath, getArgsId) {
  var state = {
    didRenameArguments: false,
    getArgsId: getArgsId
  };
  funcPath.traverse(argumentsVisitor, state); // If the traversal replaced any arguments references, then we need to
  // alias the outer function's arguments binding (be it the implicit
  // arguments object or some other parameter or variable) to the variable
  // named by argsId.

  return state.didRenameArguments;
}

var argumentsVisitor = {
  "FunctionExpression|FunctionDeclaration": function FunctionExpressionFunctionDeclaration(path) {
    path.skip();
  },
  Identifier: function Identifier(path, state) {
    if (path.node.name === "arguments" && util.isReference(path)) {
      util.replaceWithOrRemove(path, state.getArgsId());
      state.didRenameArguments = true;
    }
  }
};
var functionSentVisitor = {
  MetaProperty: function MetaProperty(path) {
    var node = path.node;

    if (node.meta.name === "function" && node.property.name === "sent") {
      var t = util.getTypes();
      util.replaceWithOrRemove(path, t.memberExpression(t.clone(this.context), t.identifier("_sent")));
    }
  }
};
var awaitVisitor = {
  Function: function Function(path) {
    path.skip(); // Don't descend into nested function scopes.
  },
  AwaitExpression: function AwaitExpression(path) {
    var t = util.getTypes(); // Convert await expressions to yield expressions.

    var argument = path.node.argument; // Transforming `await x` to `yield regeneratorRuntime.awrap(x)`
    // causes the argument to be wrapped in such a way that the runtime
    // can distinguish between awaited and merely yielded values.

    util.replaceWithOrRemove(path, t.yieldExpression(t.callExpression(util.runtimeProperty("awrap"), [argument]), false));
  }
};