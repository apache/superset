module.exports = {
  'name': 'bitOr',
  'category': 'Bitwise',
  'syntax': [
    'x | y',
    'bitOr(x, y)'
  ],
  'description': 'Bitwise OR operation. Performs the logical inclusive OR operation on each pair of corresponding bits of the two given values. The result in each position is 1 if the first bit is 1 or the second bit is 1 or both bits are 1, otherwise, the result is 0.',
  'examples': [
    '5 | 3',
    'bitOr([1, 2, 3], 4)'
  ],
  'seealso': [
    'bitAnd', 'bitNot', 'bitXor', 'leftShift', 'rightArithShift', 'rightLogShift'
  ]
};
