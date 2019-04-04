module.exports = {
  'name': 'derivative',
  'category': 'Algebra',
  'syntax': [
    'derivative(expr, variable)',
    'derivative(expr, variable, {simplify: boolean})'
  ],
  'description': 'Takes the derivative of an expression expressed in parser Nodes. The derivative will be taken over the supplied variable in the second parameter. If there are multiple variables in the expression, it will return a partial derivative.',
  'examples': [
    'derivative("2x^3", "x")',
    'derivative("2x^3", "x", {simplify: false})',
    'derivative("2x^2 + 3x + 4", "x")',
    'derivative("sin(2x)", "x")',
    'f = parse("x^2 + x")',
    'x = parse("x")',
    'df = derivative(f, x)',
    'df.eval({x: 3})'
  ],
  'seealso': [
    'simplify', 'parse', 'eval'
  ]
};
