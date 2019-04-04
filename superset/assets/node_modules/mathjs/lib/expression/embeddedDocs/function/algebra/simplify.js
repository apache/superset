module.exports = {
  'name': 'simplify',
  'category': 'Algebra',
  'syntax': [
    'simplify(expr)',
    'simplify(expr, rules)'
  ],
  'description': 'Simplify an expression tree.',
  'examples': [
    'simplify("3 + 2 / 4")',
    'simplify("2x + x")',
    'f = parse("x * (x + 2 + x)")',
    'simplified = simplify(f)',
    'simplified.eval({x: 2})'
  ],
  'seealso': [
    'derivative', 'parse', 'eval'
  ]
};
