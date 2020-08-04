module.exports = {
  'name': 'number',
  'category': 'Construction',
  'syntax': [
    'x',
    'number(x)',
    'number(unit, valuelessUnit)'
  ],
  'description':
      'Create a number or convert a string or boolean into a number.',
  'examples': [
    '2',
    '2e3',
    '4.05',
    'number(2)',
    'number("7.2")',
    'number(true)',
    'number([true, false, true, true])',
    'number(unit("52cm"), "m")'
  ],
  'seealso': [
    'bignumber', 'boolean', 'complex', 'fraction', 'index', 'matrix', 'string', 'unit'
  ]
};
