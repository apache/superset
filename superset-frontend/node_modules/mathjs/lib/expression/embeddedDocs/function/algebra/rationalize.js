module.exports = {
  'name': 'rationalize',
  'category': 'Algebra',
  'syntax': [
    'rationalize(expr)',
    'rationalize(expr, scope)',
    'rationalize(expr, scope, detailed)'
  ],
  'description': 'Transform a rationalizable expression in a rational fraction. If rational fraction is one variable polynomial then converts the numerator and denominator in canonical form, with decreasing exponents, returning the coefficients of numerator.',
  'examples': [
    'rationalize("2x/y - y/(x+1)")',
    'rationalize("2x/y - y/(x+1)", true)',
  ],
  'seealso': [
    'simplify'
  ]
};
