# Algebra (symbolic computation)

math.js has built-in support for symbolic computation ([CAS](https://www.wikiwand.com/en/Computer_algebra_system)). It can parse expressions into an expression tree and do algebraic operations like simplification and derivation on the tree.

> It's worth mentioning an excellent extension on math.js here: [mathsteps](https://github.com/socraticorg/mathsteps), a step-by-step math solver library that is focused on pedagogy (how best to teach). The math problems it focuses on are pre-algebra and algebra problems involving simplifying expressions.


## Simplify

The function [`math.simplify`](../reference/functions/simplify.md) simplifies an expression tree:

```js
// simplify an expression
console.log(math.simplify('3 + 2 / 4').toString());             // '7 / 2'
console.log(math.simplify('2x + 3x').toString());               // '5 * x'
console.log(math.simplify('x^2 + x + 3 + x^2').toString());     // '2 * x ^ 2 + x + 3'
console.log(math.simplify('x * y * -x / (x ^ 2)').toString());  // '-y'
```

The function accepts either a string or an expression tree (`Node`) as input, and outputs a simplified expression tree (`Node`). This node tree can be transformed and evaluated as described in detail on the page [Expression trees]('./expression_trees.md').

```js
// work with an expression tree, evaluate results
var f = math.parse('2x + x');
var simplified = math.simplify(f);
console.log(simplified.toString());    // '3 * x'
console.log(simplified.eval({x: 4}));  // 12
```

For more details on the theory of expression simplification, see:

- [Strategies for simplifying math expressions (Stackoverflow)](http://stackoverflow.com/questions/7540227/strategies-for-simplifying-math-expressions)
- [Symbolic computation - Simplification (Wikipedia)](https://en.wikipedia.org/wiki/Symbolic_computation#Simplification)


## Derivative

The function [`math.derivative`](../reference/functions/derivative.md) finds the symbolic derivative of an expression:

```js
// calculate a derivative
console.log(math.derivative('2x^2 + 3x + 4', 'x').toString());  // '4 * x + 3'
console.log(math.derivative('sin(2x)', 'x').toString());        // '2 * cos(2 * x)'
```

Similar to the function `math.simplify`, `math.derivative` accepts either a string or an expression tree (`Node`) as input, and outputs a simplified expression tree (`Node`).

```js
// work with an expression tree, evaluate results
var h = math.parse('x^2 + x');
var x = math.parse('x');
var dh = math.derivative(h, x);
console.log(dh.toString());       // '2 * x + 1'
console.log(dh.eval({x: 3}));     // '7'
```

The rules used by `math.derivative` can be found on Wikipedia:

- [Differentiation rules (Wikipedia)](http://en.wikipedia.org/wiki/Differentiation_rules)
