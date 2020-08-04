module.exports = {
  'name': 'bitNot',
  'category': 'Bitwise',
  'syntax': [
    '~x',
    'bitNot(x)'
  ],
  'description': 'Bitwise NOT operation. Performs a logical negation on each bit of the given value. Bits that are 0 become 1, and those that are 1 become 0.',
  'examples': [
    '~1',
    '~2',
    'bitNot([2, -3, 4])'
  ],
  'seealso': [
    'bitAnd', 'bitOr', 'bitXor', 'leftShift', 'rightArithShift', 'rightLogShift'
  ]
};
