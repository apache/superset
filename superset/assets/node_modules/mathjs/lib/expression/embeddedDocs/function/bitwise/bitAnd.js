module.exports = {
  'name': 'bitAnd',
  'category': 'Bitwise',
  'syntax': [
    'x & y',
    'bitAnd(x, y)'
  ],
  'description': 'Bitwise AND operation. Performs the logical AND operation on each pair of the corresponding bits of the two given values by multiplying them. If both bits in the compared position are 1, the bit in the resulting binary representation is 1, otherwise, the result is 0',
  'examples': [
    '5 & 3',
    'bitAnd(53, 131)',
    '[1, 12, 31] & 42'
  ],
  'seealso': [
    'bitNot', 'bitOr', 'bitXor', 'leftShift', 'rightArithShift', 'rightLogShift'
  ]
};
