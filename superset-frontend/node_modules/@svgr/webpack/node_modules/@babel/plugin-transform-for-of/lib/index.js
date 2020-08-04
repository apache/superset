"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _helperPluginUtils = require("@babel/helper-plugin-utils");

var _core = require("@babel/core");

var _noHelperImplementation = _interopRequireDefault(require("./no-helper-implementation"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _default = (0, _helperPluginUtils.declare)((api, options) => {
  api.assertVersion(7);
  const {
    loose,
    assumeArray,
    allowArrayLike
  } = options;

  if (loose === true && assumeArray === true) {
    throw new Error(`The loose and assumeArray options cannot be used together in @babel/plugin-transform-for-of`);
  }

  if (assumeArray === true && allowArrayLike === true) {
    throw new Error(`The assumeArray and allowArrayLike options cannot be used together in @babel/plugin-transform-for-of`);
  }

  if (allowArrayLike && /^7\.\d\./.test(api.version)) {
    throw new Error(`The allowArrayLike is only supported when using @babel/core@^7.10.0`);
  }

  if (assumeArray) {
    return {
      name: "transform-for-of",
      visitor: {
        ForOfStatement(path) {
          const {
            scope
          } = path;
          const {
            left,
            right,
            await: isAwait
          } = path.node;

          if (isAwait) {
            return;
          }

          const i = scope.generateUidIdentifier("i");
          let array = scope.maybeGenerateMemoised(right, true);
          const inits = [_core.types.variableDeclarator(i, _core.types.numericLiteral(0))];

          if (array) {
            inits.push(_core.types.variableDeclarator(array, right));
          } else {
            array = right;
          }

          const item = _core.types.memberExpression(_core.types.cloneNode(array), _core.types.cloneNode(i), true);

          let assignment;

          if (_core.types.isVariableDeclaration(left)) {
            assignment = left;
            assignment.declarations[0].init = item;
          } else {
            assignment = _core.types.expressionStatement(_core.types.assignmentExpression("=", left, item));
          }

          let blockBody;
          const body = path.get("body");

          if (body.isBlockStatement() && Object.keys(path.getBindingIdentifiers()).some(id => body.scope.hasOwnBinding(id))) {
            blockBody = _core.types.blockStatement([assignment, body.node]);
          } else {
            blockBody = _core.types.toBlock(body.node);
            blockBody.body.unshift(assignment);
          }

          path.replaceWith(_core.types.forStatement(_core.types.variableDeclaration("let", inits), _core.types.binaryExpression("<", _core.types.cloneNode(i), _core.types.memberExpression(_core.types.cloneNode(array), _core.types.identifier("length"))), _core.types.updateExpression("++", _core.types.cloneNode(i)), blockBody));
        }

      }
    };
  }

  const buildForOfArray = (0, _core.template)(`
    for (var KEY = 0, NAME = ARR; KEY < NAME.length; KEY++) BODY;
  `);

  const buildForOfLoose = _core.template.statements(`
    for (var ITERATOR_HELPER = CREATE_ITERATOR_HELPER(OBJECT, ALLOW_ARRAY_LIKE), STEP_KEY;
        !(STEP_KEY = ITERATOR_HELPER()).done;) BODY;
  `);

  const buildForOf = _core.template.statements(`
    var ITERATOR_HELPER = CREATE_ITERATOR_HELPER(OBJECT, ALLOW_ARRAY_LIKE), STEP_KEY;
    try {
      for (ITERATOR_HELPER.s(); !(STEP_KEY = ITERATOR_HELPER.n()).done;) BODY;
    } catch (err) {
      ITERATOR_HELPER.e(err);
    } finally {
      ITERATOR_HELPER.f();
    }
  `);

  const builder = loose ? {
    build: buildForOfLoose,
    helper: "createForOfIteratorHelperLoose",
    getContainer: nodes => nodes
  } : {
    build: buildForOf,
    helper: "createForOfIteratorHelper",
    getContainer: nodes => nodes[1].block.body
  };

  function _ForOfStatementArray(path) {
    const {
      node,
      scope
    } = path;
    const right = scope.generateUidIdentifierBasedOnNode(node.right, "arr");
    const iterationKey = scope.generateUidIdentifier("i");
    const loop = buildForOfArray({
      BODY: node.body,
      KEY: iterationKey,
      NAME: right,
      ARR: node.right
    });

    _core.types.inherits(loop, node);

    _core.types.ensureBlock(loop);

    const iterationValue = _core.types.memberExpression(_core.types.cloneNode(right), _core.types.cloneNode(iterationKey), true);

    const left = node.left;

    if (_core.types.isVariableDeclaration(left)) {
      left.declarations[0].init = iterationValue;
      loop.body.body.unshift(left);
    } else {
      loop.body.body.unshift(_core.types.expressionStatement(_core.types.assignmentExpression("=", left, iterationValue)));
    }

    return loop;
  }

  return {
    name: "transform-for-of",
    visitor: {
      ForOfStatement(path, state) {
        const right = path.get("right");

        if (right.isArrayExpression() || right.isGenericType("Array") || _core.types.isArrayTypeAnnotation(right.getTypeAnnotation())) {
          path.replaceWith(_ForOfStatementArray(path));
          return;
        }

        if (!state.availableHelper(builder.helper)) {
          (0, _noHelperImplementation.default)(loose, path, state);
          return;
        }

        const {
          node,
          parent,
          scope
        } = path;
        const left = node.left;
        let declar;
        const stepKey = scope.generateUid("step");

        const stepValue = _core.types.memberExpression(_core.types.identifier(stepKey), _core.types.identifier("value"));

        if (_core.types.isVariableDeclaration(left)) {
          declar = _core.types.variableDeclaration(left.kind, [_core.types.variableDeclarator(left.declarations[0].id, stepValue)]);
        } else {
          declar = _core.types.expressionStatement(_core.types.assignmentExpression("=", left, stepValue));
        }

        path.ensureBlock();
        node.body.body.unshift(declar);
        const nodes = builder.build({
          CREATE_ITERATOR_HELPER: state.addHelper(builder.helper),
          ITERATOR_HELPER: scope.generateUidIdentifier("iterator"),
          ALLOW_ARRAY_LIKE: allowArrayLike ? _core.types.booleanLiteral(true) : null,
          STEP_KEY: _core.types.identifier(stepKey),
          OBJECT: node.right,
          BODY: node.body
        });
        const container = builder.getContainer(nodes);

        _core.types.inherits(container[0], node);

        _core.types.inherits(container[0].body, node.body);

        if (_core.types.isLabeledStatement(parent)) {
          container[0] = _core.types.labeledStatement(parent.label, container[0]);
          path.parentPath.replaceWithMultiple(nodes);
          path.remove();
        } else {
          path.replaceWithMultiple(nodes);
        }
      }

    }
  };
});

exports.default = _default;