var assert = require('assert');
var math = require('../../index');
var math2 = math.create();

describe ('typed', function () {

  it('should test whether a value is a number', function () {
    assert.strictEqual(math.type.isNumber(2), true);
    assert.strictEqual(math.type.isNumber('foo'), false);
    assert.strictEqual(math.type.isNumber('2'), false);
    assert.strictEqual(math.type.isNumber(), false);
  });

  it('should test whether a value is a complex number', function () {
    assert.strictEqual(math.type.isComplex(math.complex(2, 3)), true);
    assert.strictEqual(math.type.isComplex(math2.complex(2, 3)), true);
    assert.strictEqual(math.type.isComplex({isComplex: true}), false);
    assert.strictEqual(math.type.isComplex(2), false);
    assert.strictEqual(math.type.isComplex(), false);
  });

  it('should test whether a value is a BigNumber', function () {
    assert.strictEqual(math.type.isBigNumber(math.bignumber(2)), true);
    assert.strictEqual(math.type.isBigNumber(math2.bignumber(2)), true);
    assert.strictEqual(math.type.isBigNumber({isBigNumber: true}), false);
    assert.strictEqual(math.type.isBigNumber(2), false);
    assert.strictEqual(math.type.isBigNumber(), false);
  });

  it('should test whether a value is a Fraction', function () {
    assert.strictEqual(math.type.isFraction(math.fraction(2,3)), true);
    assert.strictEqual(math.type.isFraction(math2.fraction(2,3)), true);
    assert.strictEqual(math.type.isFraction({isFraction: true}), false);
    assert.strictEqual(math.type.isFraction(2), false);
    assert.strictEqual(math.type.isFraction(), false);
  });

  it('should test whether a value is a Unit', function () {
    assert.strictEqual(math.type.isUnit(math.unit('5cm')), true);
    assert.strictEqual(math.type.isUnit(math2.unit('5cm')), true);
    assert.strictEqual(math.type.isUnit({isUnit: true}), false);
    assert.strictEqual(math.type.isUnit(2), false);
    assert.strictEqual(math.type.isUnit(), false);
  });

  it('should test whether a value is a string', function () {
    assert.strictEqual(math.type.isString("hello"), true);
    assert.strictEqual(math.type.isString({}), false);
    assert.strictEqual(math.type.isString(2), false);
    assert.strictEqual(math.type.isString(), false);
  });

  it('should test whether a value is an Array', function () {
    assert.strictEqual(math.type.isArray([]), true);
    assert.strictEqual(math.type.isArray(math2.matrix()), false);
    assert.strictEqual(math.type.isArray(Object.create([])), false);
    assert.strictEqual(math.type.isArray(2), false);
    assert.strictEqual(math.type.isArray(), false);
  });

  it('should test whether a value is a Matrix', function () {
    assert.strictEqual(math.type.isMatrix(math.matrix()), true);
    assert.strictEqual(math.type.isMatrix(math.matrix([], 'sparse')), true);
    assert.strictEqual(math.type.isMatrix(math2.matrix()), true);
    assert.strictEqual(math.type.isMatrix({isMatrix: true}), false);
    assert.strictEqual(math.type.isMatrix(2), false);
    assert.strictEqual(math.type.isMatrix(), false);
  });

  it('should test whether a value is a DenseMatrix', function () {
    assert.strictEqual(math.type.isDenseMatrix(math.matrix()), true);
    assert.strictEqual(math.type.isDenseMatrix(math.matrix([], 'sparse')), false);
    assert.strictEqual(math.type.isDenseMatrix(math2.matrix()), true);
    assert.strictEqual(math.type.isDenseMatrix({isDenseMatrix: true}), false);
    assert.strictEqual(math.type.isDenseMatrix(2), false);
    assert.strictEqual(math.type.isDenseMatrix(), false);
  });

  it('should test whether a value is a SparseMatrix', function () {
    assert.strictEqual(math.type.isSparseMatrix(math.matrix()), false);
    assert.strictEqual(math.type.isSparseMatrix(math.matrix([], 'sparse')), true);
    assert.strictEqual(math.type.isSparseMatrix(math2.matrix([], 'sparse')), true);
    assert.strictEqual(math.type.isSparseMatrix({isSparseMatrix: true}), false);
    assert.strictEqual(math.type.isSparseMatrix(2), false);
    assert.strictEqual(math.type.isSparseMatrix(), false);
  });

  it('should test whether a value is a Range', function () {
    assert.strictEqual(math.type.isRange(new math.type.Range()), true);
    assert.strictEqual(math.type.isRange(new math2.type.Range()), true);
    assert.strictEqual(math.type.isRange({isRange: true}), false);
    assert.strictEqual(math.type.isRange(2), false);
    assert.strictEqual(math.type.isRange(), false);
  });

  it('should test whether a value is an Index', function () {
    assert.strictEqual(math.type.isIndex(new math.type.Index()), true);
    assert.strictEqual(math.type.isIndex(new math2.type.Index()), true);
    assert.strictEqual(math.type.isIndex({isIndex: true}), false);
    assert.strictEqual(math.type.isIndex(2), false);
    assert.strictEqual(math.type.isIndex(), false);
  });

  it('should test whether a value is a boolean', function () {
    assert.strictEqual(math.type.isBoolean(true), true);
    assert.strictEqual(math.type.isBoolean(false), true);
    assert.strictEqual(math.type.isBoolean(2), false);
    assert.strictEqual(math.type.isBoolean(), false);
  });

  it('should test whether a value is a ResultSet', function () {
    assert.strictEqual(math.type.isResultSet(new math.type.ResultSet()), true);
    assert.strictEqual(math.type.isResultSet(new math2.type.ResultSet()), true);
    assert.strictEqual(math.type.isResultSet({isResultSet: true}), false);
    assert.strictEqual(math.type.isResultSet(2), false);
    assert.strictEqual(math.type.isResultSet(), false);
  });

  it('should test whether a value is an Help', function () {
    assert.strictEqual(math.type.isHelp(new math.type.Help({doc:[]})), true);
    assert.strictEqual(math.type.isHelp(new math2.type.Help({doc:[]})), true);
    assert.strictEqual(math.type.isHelp({isHelp: true}), false);
    assert.strictEqual(math.type.isHelp(2), false);
    assert.strictEqual(math.type.isHelp(), false);
  });

  it('should test whether a value is a function', function () {
    assert.strictEqual(math.type.isFunction(function () {}), true);
    assert.strictEqual(math.type.isFunction(2), false);
    assert.strictEqual(math.type.isFunction(), false);
  });

  it('should test whether a value is a Date', function () {
    assert.strictEqual(math.type.isDate(new Date()), true);
    assert.strictEqual(math.type.isDate(function () {}), false);
    assert.strictEqual(math.type.isDate(2), false);
    assert.strictEqual(math.type.isDate(), false);
  });

  it('should test whether a value is a RegExp', function () {
    assert.strictEqual(math.type.isRegExp(/test/), true);
    assert.strictEqual(math.type.isRegExp(function () {}), false);
    assert.strictEqual(math.type.isRegExp(2), false);
    assert.strictEqual(math.type.isRegExp(), false);
  });

  it('should test whether a value is an Object', function () {
    assert.strictEqual(math.type.isObject({}), true);
    assert.strictEqual(math.type.isObject(math.matrix()), true);
    assert.strictEqual(math.type.isObject(/test/), true);
    assert.strictEqual(math.type.isObject(function () {}), false);
    assert.strictEqual(math.type.isObject(2), false);
    assert.strictEqual(math.type.isObject(), false);
  });

  it('should test whether a value is null', function () {
    assert.strictEqual(math.type.isNull(null), true);
    assert.strictEqual(math.type.isNull(math.matrix()), false);
    assert.strictEqual(math.type.isNull(2), false);
    assert.strictEqual(math.type.isNull(), false);
  });

  it('should test whether a value is undefined', function () {
    assert.strictEqual(math.type.isUndefined(undefined), true);
    assert.strictEqual(math.type.isUndefined(math.matrix()), false);
    assert.strictEqual(math.type.isUndefined(2), false);
    assert.strictEqual(math.type.isUndefined(), true);
    assert.strictEqual(math.type.isUndefined(null), false);
  });

  it('should test whether a value is an OperatorNode', function () {
    assert.strictEqual(math.type.isOperatorNode(new math.expression.node.OperatorNode('', '', [])), true);
    assert.strictEqual(math.type.isOperatorNode(new math2.expression.node.OperatorNode('', '', [])), true);
    assert.strictEqual(math.type.isOperatorNode({isOperatorNode: true}), false);
    assert.strictEqual(math.type.isOperatorNode(2), false);
    assert.strictEqual(math.type.isOperatorNode(), false);
  });

  it('should test whether a value is a ConstantNode', function () {
    assert.strictEqual(math.type.isConstantNode(new math.expression.node.ConstantNode(2)), true);
    assert.strictEqual(math.type.isConstantNode(new math2.expression.node.ConstantNode(2)), true);
    assert.strictEqual(math.type.isConstantNode({isConstantNode: true}), false);
    assert.strictEqual(math.type.isConstantNode(2), false);
    assert.strictEqual(math.type.isConstantNode(), false);
  });

  it('should test whether a value is a SymolNode', function () {
    assert.strictEqual(math.type.isSymbolNode(new math.expression.node.SymbolNode('')), true);
    assert.strictEqual(math.type.isSymbolNode(new math2.expression.node.SymbolNode('')), true);
    assert.strictEqual(math.type.isSymbolNode({isSymbolNode: true}), false);
    assert.strictEqual(math.type.isSymbolNode(2), false);
    assert.strictEqual(math.type.isSymbolNode(), false);
  });

  it('should test whether a value is a ParenthesisNode', function () {
    assert.strictEqual(math.type.isParenthesisNode(new math.expression.node.ParenthesisNode(new math.expression.node.SymbolNode(''))), true);
    assert.strictEqual(math.type.isParenthesisNode(new math2.expression.node.ParenthesisNode(new math2.expression.node.SymbolNode(''))), true);
    assert.strictEqual(math.type.isParenthesisNode({isParenthesisNode: true}), false);
    assert.strictEqual(math.type.isParenthesisNode(2), false);
    assert.strictEqual(math.type.isParenthesisNode(), false);
  });

  it('should test whether a value is a FunctionNode', function () {
    assert.strictEqual(math.type.isFunctionNode(new math.expression.node.FunctionNode('',[])), true);
    assert.strictEqual(math.type.isFunctionNode(new math2.expression.node.FunctionNode('',[])), true);
    assert.strictEqual(math.type.isFunctionNode({isFunctionNode: true}), false);
    assert.strictEqual(math.type.isFunctionNode(2), false);
    assert.strictEqual(math.type.isFunctionNode(), false);
  });

  it('should test whether a value is a FunctionAssignmentNode', function () {
    assert.strictEqual(math.type.isFunctionAssignmentNode(new math.expression.node.FunctionAssignmentNode('',[], new math.expression.node.SymbolNode(''))), true);
    assert.strictEqual(math.type.isFunctionAssignmentNode(new math2.expression.node.FunctionAssignmentNode('',[], new math2.expression.node.SymbolNode(''))), true);
    assert.strictEqual(math.type.isFunctionAssignmentNode({isFunctionAssignmentNode: true}), false);
    assert.strictEqual(math.type.isFunctionAssignmentNode(2), false);
    assert.strictEqual(math.type.isFunctionAssignmentNode(), false);
  });

  it('should test whether a value is an ArrayNode', function () {
    assert.strictEqual(math.type.isArrayNode(new math.expression.node.ArrayNode([])), true);
    assert.strictEqual(math.type.isArrayNode(new math2.expression.node.ArrayNode([])), true);
    assert.strictEqual(math.type.isArrayNode({isArrayNode: true}), false);
    assert.strictEqual(math.type.isArrayNode(2), false);
    assert.strictEqual(math.type.isArrayNode(), false);
  });

  it('should test whether a value is an AssignmentNode', function () {
    var s = new math.expression.node.SymbolNode('');
    var i = new math.expression.node.IndexNode([]);
    var v = new math.expression.node.ConstantNode(2);

    assert.strictEqual(math.type.isAssignmentNode(new math.expression.node.AssignmentNode(s, i, v)), true);
    assert.strictEqual(math.type.isAssignmentNode(new math2.expression.node.AssignmentNode(s, i, v)), true);
    assert.strictEqual(math.type.isAssignmentNode({isAssignmentNode: true}), false);
    assert.strictEqual(math.type.isAssignmentNode(2), false);
    assert.strictEqual(math.type.isAssignmentNode(), false);
  });

  it('should test whether a value is an AccessorNode', function () {
    var a = new math.expression.node.SymbolNode('a');
    var index = new math.expression.node.IndexNode([new math.expression.node.ConstantNode('b')]);

    assert.strictEqual(math.type.isAccessorNode(new math.expression.node.AccessorNode(a, index)), true);
    assert.strictEqual(math.type.isAccessorNode(new math2.expression.node.AccessorNode(a, index)), true);
    assert.strictEqual(math.type.isAccessorNode({isAccessorNode: true}), false);
    assert.strictEqual(math.type.isAccessorNode(2), false);
    assert.strictEqual(math.type.isAccessorNode(), false);
  });

  it('should test whether a value is a BlockNode', function () {
    assert.strictEqual(math.type.isBlockNode(new math.expression.node.BlockNode([])), true);
    assert.strictEqual(math.type.isBlockNode(new math2.expression.node.BlockNode([])), true);
    assert.strictEqual(math.type.isBlockNode({isBlockNode: true}), false);
    assert.strictEqual(math.type.isBlockNode(2), false);
    assert.strictEqual(math.type.isBlockNode(), false);
  });

  it('should test whether a value is a ObjectNode', function () {
    assert.strictEqual(math.type.isObjectNode(new math.expression.node.ObjectNode({})), true);
    assert.strictEqual(math.type.isObjectNode(new math2.expression.node.ObjectNode({})), true);
    assert.strictEqual(math.type.isObjectNode({isObjectNode: true}), false);
    assert.strictEqual(math.type.isObjectNode(2), false);
    assert.strictEqual(math.type.isObjectNode(), false);
  });

  it('should test whether a value is a ConditionalNode', function () {
    var c = new math.expression.node.SymbolNode('');
    var t = new math.expression.node.ConstantNode(1);
    var f = new math.expression.node.ConstantNode(2);

    assert.strictEqual(math.type.isConditionalNode(new math.expression.node.ConditionalNode(c, t, f)), true);
    assert.strictEqual(math.type.isConditionalNode(new math2.expression.node.ConditionalNode(c, t, f)), true);
    assert.strictEqual(math.type.isConditionalNode({isConditionalNode: true}), false);
    assert.strictEqual(math.type.isConditionalNode(2), false);
    assert.strictEqual(math.type.isConditionalNode(), false);
  });

  it('should test whether a value is an IndexNode', function () {
    assert.strictEqual(math.type.isIndexNode(new math.expression.node.IndexNode([])), true);
    assert.strictEqual(math.type.isIndexNode(new math2.expression.node.IndexNode([])), true);
    assert.strictEqual(math.type.isIndexNode({isIndexNode: true}), false);
    assert.strictEqual(math.type.isIndexNode(2), false);
    assert.strictEqual(math.type.isIndexNode(), false);
  });

  it('should test whether a value is a RangeNode', function () {
    var s = new math.expression.node.ConstantNode(1);
    var e = new math.expression.node.ConstantNode(10);

    assert.strictEqual(math.type.isRangeNode(new math.expression.node.RangeNode(s, e)), true);
    assert.strictEqual(math.type.isRangeNode(new math2.expression.node.RangeNode(s, e)), true);
    assert.strictEqual(math.type.isRangeNode({isRangeNode: true}), false);
    assert.strictEqual(math.type.isRangeNode(2), false);
    assert.strictEqual(math.type.isRangeNode(), false);
  });

  it('should test whether a value is a Node', function () {
    var s = new math.expression.node.ConstantNode(1);
    var e = new math.expression.node.ConstantNode(10);

    assert.strictEqual(math.type.isNode(new math.expression.node.ConstantNode(1)), true);
    assert.strictEqual(math.type.isNode(new math2.expression.node.ConstantNode(1)), true);
    assert.strictEqual(math.type.isNode(new math.expression.node.SymbolNode('a')), true);
    assert.strictEqual(math.type.isNode({isNode: true}), false);
    assert.strictEqual(math.type.isNode(2), false);
    assert.strictEqual(math.type.isNode(), false);
  });

  it('should test whether a value is a chain', function () {
    assert.strictEqual(math.type.isChain(math.chain(2)), true);
    assert.strictEqual(math.type.isChain({isChain: true}), false);
    assert.strictEqual(math.type.isChain(2), false);
    assert.strictEqual(math.type.isChain(), false);
  });

});
