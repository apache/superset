module.exports = {
  'name': 'import',
  'category': 'Core',
  'syntax': [
    'import(functions)',
    'import(functions, options)'
  ],
  'description': 'Import functions or constants from an object.',
  'examples': [
    'import({myFn: f(x)=x^2, myConstant: 32 })',
    'myFn(2)',
    'myConstant'
  ],
  'seealso': []
};
