// test simplify
var assert = require('assert');
var math = require('../../../index');

describe('simplify', function() {

  function simplifyAndCompare(left, right, scope) {
    try {
        if (scope) {
            assert.equal(math.simplify(left, scope).toString(), math.parse(right).toString());
        } else {
            assert.equal(math.simplify(left).toString(), math.parse(right).toString());
        }
    } catch (err) {
        if (err instanceof Error) {
            console.log(err.stack);
        } else {
            console.log(new Error(err));
        }
        throw err;
    }
  }

  function simplifyAndCompareEval (left, right, scope) {
    scope = scope || {};
    assert.equal(math.simplify(left).eval(scope), math.parse(right).eval(scope));
  }

  it('should not change the value of the function', function() {
    simplifyAndCompareEval('3+2/4+2*8', '39/2');
    simplifyAndCompareEval('x+1+x', '2x+1', {x:7});
    simplifyAndCompareEval('x+1+2x', '3x+1', {x:7});
    simplifyAndCompareEval('x^2+x-3+x^2', '2x^2+x-3', {x:7});
  });

  it('should simplify exponents', function() {
    // power rule
    simplifyAndCompare('(x^2)^3', 'x^6');
    simplifyAndCompare('2*(x^2)^3', '2*x^6');

    // simplify exponent
    simplifyAndCompare('x^(2+3)', 'x^5');

    // right associative
    simplifyAndCompare('x^2^3', 'x^8');
  });

  it('should simplify rational expressions with no symbols to fraction', function() {
    simplifyAndCompare('3*4', '12');
    simplifyAndCompare('3+2/4', '7/2');
  });

  it('should simplify equations with different variables', function() {
    simplifyAndCompare('-(x+y)', '-(x + y)');
    simplifyAndCompare('-(x*y)', '-(x * y)');
    simplifyAndCompare('-(x+y+x+y)', '-(2 * (y + x))');
    simplifyAndCompare('(x-y)', 'x - y');
    simplifyAndCompare('0+(x-y)', 'x - y');
    simplifyAndCompare('-(x-y)', 'y - x');
    simplifyAndCompare('-1 * (x-y)', 'y - x');
    simplifyAndCompare('x + y + x + 2y', '3 * y + 2 * x');
  });

  it('should simplify (-1)*n', function() {
    simplifyAndCompare('(-1)*4', '-4');
    simplifyAndCompare('(-1)*x', '-x');
  });

  it('should handle function assignments', function() {
    var node = math.expression.node;
    var f = new node.FunctionAssignmentNode('sigma', ['x'], math.parse('1 / (1 + exp(-x))'));
    assert.equal(f.toString(), 'sigma(x) = 1 / (1 + exp(-x))');
    assert.equal(f.eval()(5), 0.9933071490757153);
    var fsimplified = math.simplify.simplifyCore(f);
    assert.equal(fsimplified.toString(), 'sigma(x) = 1 / (1 + exp(-x))');
    assert.equal(fsimplified.eval()(5), 0.9933071490757153);
  });

  it('simplifyCore should handle different node types', function() {
    var testSimplifyCore = function(expr, expected) {
        var actual = math.simplify.simplifyCore(math.parse(expr)).toString();
        assert.equal(actual, expected);
    }
    testSimplifyCore("5*x*3", "15 * x");
    testSimplifyCore("5*x*3*x", "15 * x * x");

    testSimplifyCore("x-0", "x");
    testSimplifyCore("0-x", "-x");
    testSimplifyCore("0-3", "-3");
    testSimplifyCore("x+0", "x");
    testSimplifyCore("0+x", "x");
    testSimplifyCore("0*x", "0");
    testSimplifyCore("x*0", "0");
    testSimplifyCore("x*1", "x");
    testSimplifyCore("1*x", "x");
    testSimplifyCore("-(x)", "-x");
    testSimplifyCore("0/x", "0");
    testSimplifyCore("(1*x + y*0)*1+0", "x");
    testSimplifyCore("sin(x+0)*1", "sin(x)");
    testSimplifyCore("((x+0)*1)", "x");
    testSimplifyCore("sin((x-0)*1+y*0)", "sin(x)");
    testSimplifyCore("((x)*(y))", "(x * y)");
    testSimplifyCore("((x)*(y))^1", "(x * y)");

    // constant folding
    testSimplifyCore("1+2", "3");
    testSimplifyCore("2*3", "6");
    testSimplifyCore("2-3", "-1");
    testSimplifyCore("3/2", "1.5");
    testSimplifyCore("3^2", "9");
  });

  it('should simplifyCore convert +unaryMinus to subtract', function() {
      simplifyAndCompareEval('--2', '2');
      var result = math.simplify('x + y + a', [math.simplify.simplifyCore], {a: -1}).toString()
      assert.equal(result, "x + y - 1");
  });

  it('should simplify convert minus and unary minus', function() {
    // see https://github.com/josdejong/mathjs/issues/1013
    assert.equal(math.simplify('0 - -1', {}).toString(), '1');
    assert.equal(math.simplify('0 - -x', {}).toString(), 'x');
    assert.equal(math.simplify('0----x', {}).toString(), 'x');
    assert.equal(math.simplify('1 - -x', {}).toString(), 'x + 1');
    assert.equal(math.simplify('0 - (-x)', {}).toString(), 'x');
    assert.equal(math.simplify('-(-x)', {}).toString(), 'x');
    assert.equal(math.simplify('0 - (x - y)', {}).toString(), 'y - x');
  });

  it('should handle custom functions', function() {
    function doubleIt (x) { return x + x }
    var node = math.expression.node;
    var f = new node.FunctionNode(new node.SymbolNode('doubleIt'), [new node.SymbolNode('value')]);
    assert.equal(f.toString(), 'doubleIt(value)');
    assert.equal(f.eval({ doubleIt: doubleIt, value: 4 }), 8);
    var fsimplified = math.simplify.simplifyCore(f);
    assert.equal(fsimplified.toString(), 'doubleIt(value)');
    assert.equal(fsimplified.eval({ doubleIt: doubleIt, value: 4 }), 8);
  });

  it('should handle immediately invoked function assignments', function() {
    var node = math.expression.node;
    var s = new node.FunctionAssignmentNode('sigma', ['x'], math.parse('1 / (1 + exp(-x))'));
    var f = new node.FunctionNode(s, [new node.SymbolNode('x')]);
    assert.equal(f.toString(), '(sigma(x) = 1 / (1 + exp(-x)))(x)');
    assert.equal(f.eval({x: 5}), 0.9933071490757153);
    var fsimplified = math.simplify.simplifyCore(f);
    assert.equal(fsimplified.toString(), '(sigma(x) = 1 / (1 + exp(-x)))(x)');
    assert.equal(fsimplified.eval({x: 5}), 0.9933071490757153);
  })

  it('should simplify (n- -n1)', function() {
    simplifyAndCompare('2 + -3', '-1');
    simplifyAndCompare('2 - 3', '-1');
    simplifyAndCompare('2 - -3', '5');
    var e = math.parse('2 - -3');
    e = math.simplify.simplifyCore(e);
    assert.equal(e.toString(), '5'); // simplifyCore
    simplifyAndCompare('x - -x', '2*x');
    var e = math.parse('x - -x');
    e = math.simplify.simplifyCore(e);
    assert.equal(e.toString(), 'x + x'); // not a core simplification since + is cheaper than *
  });

  it('should preserve the value of BigNumbers', function() {
    var bigmath = math.create({number: 'BigNumber', precision: 64});
    assert.deepEqual(bigmath.simplify('111111111111111111 + 111111111111111111').eval(), bigmath.eval('222222222222222222'));
    assert.deepEqual(bigmath.simplify('1 + 111111111111111111').eval(), bigmath.eval('111111111111111112'));
    assert.deepEqual(bigmath.simplify('1/2 + 11111111111111111111').eval(), bigmath.eval('11111111111111111111.5'));
    assert.deepEqual(bigmath.simplify('1/3 + 11111111111111111111').eval(), bigmath.eval('11111111111111111111.33333333333333333333333333333333333333333333'));
    assert.deepEqual(bigmath.simplify('3 + 1 / 11111111111111111111').eval(), bigmath.eval('3 + 1 / 11111111111111111111'));
  });

  it('should not change the value of numbers when converting to fractions (1)', function() {
    simplifyAndCompareEval('1e-10', '1e-10');
  });

  it('should not change the value of numbers when converting to fractions (2)', function() {
    simplifyAndCompareEval('0.2 * 1e-14', '2e-15');
  });

  it.skip('should not change the value of numbers when converting to fractions (3)', function() {
    // TODO this requires that all operators and functions have the correct logic in their 'Fraction' typed-functions.
    //      Ideally they should convert parameters to Fractions if they can all be expressed exactly,
    //      otherwise convert all parameters to the 'number' type.
    simplifyAndCompareEval('1 - 1e-10', '1 - 1e-10');
    simplifyAndCompareEval('1 + 1e-10', '1 + 1e-10');
    simplifyAndCompareEval('1e-10 / 2', '1e-10 / 2');
    simplifyAndCompareEval('(1e-5)^2', '(1e-5)^2');
    simplifyAndCompareEval('min(1, -1e-10)', '-1e-10');
    simplifyAndCompareEval('max(1e-10, -1)', '1e-10');
  });

  it('should simplify non-rational expressions with no symbols to number', function() {
    simplifyAndCompare('3+sin(4)', '2.2431975046920716');
  });

  it('should collect like terms', function() {
    simplifyAndCompare('x+x', '2*x');
    simplifyAndCompare('2x+x', '3*x');
    simplifyAndCompare('2(x+1)+(x+1)', '3*(x + 1)');
    simplifyAndCompare('y*x^2+2*x^2', '(y+2)*x^2');
  });

  it('should collect separated like terms', function() {
    simplifyAndCompare('x+1+x', '2*x+1');
    simplifyAndCompare('x^2+x+3+x^2', '2*x^2+x+3');
    simplifyAndCompare('x+1+2x', '3*x+1');
    simplifyAndCompare('x-1+x', '2*x-1');
    simplifyAndCompare('x-1-2x+2', '1-x');
  });

  it('should collect like terms that are embedded in other terms', function() {
    simplifyAndCompare('10 - (x - 2)', '12 - x');
    simplifyAndCompare('x - (y + x)', '-y');
    simplifyAndCompare('x - (y - (y - x))', '0');
  });

  it('should collect separated like factors', function() {
    simplifyAndCompare('x*y*-x/(x^2)', '-y');
    simplifyAndCompare('x/2*x', 'x^2/2');
    simplifyAndCompare('x*2*x', '2*x^2');
  });

  it('should handle nested exponentiation', function() {
    simplifyAndCompare('(x^2)^3', 'x^6');
    simplifyAndCompare('(x^y)^z', 'x^(y*z)');
    simplifyAndCompare('8 * x ^ 9 + 2 * (x ^ 3) ^ 3', '10 * x ^ 9');
  });

  it('should not run into an infinite recursive loop', function () {
    simplifyAndCompare('2n - 1', '2 * n - 1');
    simplifyAndCompare('16n - 1', '16 * n - 1');
    simplifyAndCompare('16n / 1', '16 * n');
    simplifyAndCompare('8 / 5n', 'n * 8 / 5');
    simplifyAndCompare('8n - 4n', '4 * n');
    simplifyAndCompare('8 - 4n', '8 - 4 * n');
    simplifyAndCompare('8 - n', '8 - n');
  });

  it('should handle non-existing functions like a pro', function() {
    simplifyAndCompare('foo(x)', 'foo(x)');
    simplifyAndCompare('foo(1)', 'foo(1)');
    simplifyAndCompare('myMultiArg(x, y, z, w)', 'myMultiArg(x, y, z, w)');
  });

  it ('should support custom rules', function() {
      var node = math.simplify("y+x",[{l:'n1-n2',r:'-n2+n1'}],{x:5})
      assert.equal(node.toString(), 'y + 5');
  });

  it('should handle valid built-in constant symbols in rules', function() {
    assert.equal(math.simplify('true', ['true -> 1']).toString(), '1');
    assert.equal(math.simplify('false', ['false -> 0']).toString(), '0');
    assert.equal(math.simplify('log(e)', ['log(e) -> 1']).toString(), '1');
    assert.equal(math.simplify('sin(pi * x)', ['sin(pi * n) -> 0']).toString(), '0');
    assert.equal(math.simplify('i', ['i -> 1']).toString(), '1');
    assert.equal(math.simplify('Infinity', ['Infinity -> 1']).toString(), '1');
    assert.equal(math.simplify('LN2', ['LN2 -> 1']).toString(), '1');
    assert.equal(math.simplify('LN10', ['LN10 -> 1']).toString(), '1');
    assert.equal(math.simplify('LOG2E', ['LOG2E -> 1']).toString(), '1');
    assert.equal(math.simplify('LOG10E', ['LOG10E -> 1']).toString(), '1');
    assert.equal(math.simplify('NaN', ['NaN -> 1']).toString(), '1');
    assert.equal(math.simplify('phi', ['phi -> 1']).toString(), '1');
    assert.equal(math.simplify('SQRT1_2', ['SQRT1_2 -> 1']).toString(), '1');
    assert.equal(math.simplify('SQRT2', ['SQRT2 -> 1']).toString(), '1');
    assert.equal(math.simplify('tau', ['tau -> 1']).toString(), '1');
  });

  it('should throw an error for invalid built-in constant symbols in rules', function() {
    assert.throws(function(){ math.simplify('null', ['null -> 1']).toString(); });
    assert.throws(function(){ math.simplify('uninitialized', ['uninitialized -> 1']).toString(); });
    assert.throws(function(){ math.simplify('version', ['version -> 1']).toString(); });
  });

  it('should remove addition of 0', function() {
    simplifyAndCompare('x+0', 'x');
    simplifyAndCompare('x-0', 'x');
  });

  it('resolve() should substitute scoped constants', function() {
    assert.equal(
        math.simplify.resolve(math.parse('x+y'), {x:1}).toString(),
        "1 + y"
    ); // direct
    simplifyAndCompare('x+y', 'x+y', {}); // operator
    simplifyAndCompare('x+y', 'y+1', {x:1});
    simplifyAndCompare('x+y', 'y+1', {x:math.parse('1')});
    simplifyAndCompare('x+y', '3', {x:1,y:2});
    simplifyAndCompare('x+x+x', '3*x');
    simplifyAndCompare('y', 'x+1', {y:math.parse("1+x")});
    simplifyAndCompare('y', '3', {x:2, y:math.parse("1+x")});
    simplifyAndCompare('x+y', '3*x', {y:math.parse("x+x")});
    simplifyAndCompare('x+y', '6', {x:2,y:math.parse("x+x")});
    simplifyAndCompare('x+(y+2-1-1)', '6', {x:2,y:math.parse("x+x")}); // parentheses
    simplifyAndCompare('log(x+y)', String(Math.log(6)), {x:2,y:math.parse("x+x")}); // function
    simplifyAndCompare('combinations( ceil(abs(sin(x)) * y), abs(x) )',
        'combinations(ceil(0.9092974268256817 * y ), 2)', {x:-2});

    // TODO(deal with accessor nodes) simplifyAndCompare('size(text)[1]', '11', {text: "hello world"})
  });

  describe('expression parser' ,function () {

    it('should evaluate simplify containing string value', function() {
      var res = math.eval('simplify("2x + 3x")');
      assert.ok(res && res.isNode)
      assert.equal(res.toString(), '5 * x');
    });

    it('should evaluate simplify containing nodes', function() {
      var res = math.eval('simplify(parse("2x + 3x"))');
      assert.ok(res && res.isNode)
      assert.equal(res.toString(), '5 * x');
    });

    it('should compute and simplify derivatives', function() {
      var res = math.eval('derivative("5x*3x", "x")');
      assert.ok(res && res.isNode)
      assert.equal(res.toString(), '30 * x');
    });

    it('should compute and simplify derivatives (2)', function() {
      var scope = {}
      math.eval('a = derivative("5x*3x", "x")', scope)
      var res = math.eval('simplify(a)', scope);
      assert.ok(res && res.isNode)
      assert.equal(res.toString(), '30 * x');
    });

    it.skip('should compute and simplify derivatives (3)', function() {
      // TODO: this requires the + operator to support Nodes,
      //       i.e.   math.add(5, math.parse('2')) => return an OperatorNode
      var res = math.eval('simplify(5+derivative(5/(3x), x))');
      assert.ok(res && res.isNode)
      assert.equal(res.toString(), '5 - 15 / (3 * x) ^ 2');
    });

  });

});
