module.exports = {
  'name': 'typed',
  'category': 'Core',
  'syntax': [
    'typed(signatures)',
    'typed(name, signatures)'
  ],
  'description': 'Create a typed function.',
  'examples': [
    'double = typed({ "number, number": f(x)=x+x })',
    'double(2)',
    'double("hello")'
  ],
  'seealso': []
};
