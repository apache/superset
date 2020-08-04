module.exports = {
  'name': 'ones',
  'category': 'Matrix',
  'syntax': [
    'ones(m)',
    'ones(m, n)',
    'ones(m, n, p, ...)',
    'ones([m])',
    'ones([m, n])',
    'ones([m, n, p, ...])'
  ],
  'description': 'Create a matrix containing ones.',
  'examples': [
    'ones(3)',
    'ones(3, 5)',
    'ones([2,3]) * 4.5',
    'a = [1, 2, 3; 4, 5, 6]',
    'ones(size(a))'
  ],
  'seealso': [
    'concat', 'det', 'diag', 'eye', 'inv', 'range', 'size', 'squeeze', 'subset', 'trace', 'transpose', 'zeros'
  ]
};
