module.exports = {
  'name': 'sparse',
  'category': 'Construction',
  'syntax': [
    'sparse()',
    'sparse([a1, b1, ...; a1, b2, ...])',
    'sparse([a1, b1, ...; a1, b2, ...], "number")'
  ],
  'description':
  'Create a sparse matrix.',
  'examples': [
    'sparse()',
    'sparse([3, 4; 5, 6])',
    'sparse([3, 0; 5, 0], "number")'
  ],
  'seealso': [
    'bignumber', 'boolean', 'complex', 'index', 'number', 'string', 'unit', 'matrix'
  ]
};
