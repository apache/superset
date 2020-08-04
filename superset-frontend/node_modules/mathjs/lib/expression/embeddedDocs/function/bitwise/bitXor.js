module.exports = {
  'name': 'bitXor',
  'category': 'Bitwise',
  'syntax': [
    'bitXor(x, y)'
  ],
  'description': 'Bitwise XOR operation, exclusive OR. Performs the logical exclusive OR operation on each pair of corresponding bits of the two given values. The result in each position is 1 if only the first bit is 1 or only the second bit is 1, but will be 0 if both are 0 or both are 1.',
  'examples': [
    'bitOr(1, 2)',
    'bitXor([2, 3, 4], 4)'
  ],
  'seealso': [
    'bitAnd', 'bitNot', 'bitOr', 'leftShift', 'rightArithShift', 'rightLogShift'
  ]
};
