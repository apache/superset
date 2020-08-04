module.exports = {
  'name': 'squeeze',
  'category': 'Matrix',
  'syntax': [
    'squeeze(x)'
  ],
  'description': 'Remove inner and outer singleton dimensions from a matrix.',
  'examples': [
    'a = zeros(3,2,1)',
    'size(squeeze(a))',
    'b = zeros(1,1,3)',
    'size(squeeze(b))'
  ],
  'seealso': [
    'concat', 'det', 'diag', 'eye', 'inv', 'ones', 'range', 'size', 'subset', 'trace', 'transpose', 'zeros'
  ]
};
