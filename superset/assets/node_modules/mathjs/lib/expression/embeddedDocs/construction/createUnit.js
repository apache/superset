module.exports = {
  'name': 'createUnit',
  'category': 'Construction',
  'syntax': [
    'createUnit(definitions)',
    'createUnit(name, definition)'
  ],
  'description':
      'Create a user-defined unit and register it with the Unit type.',
  'examples': [
    'createUnit("foo")',
    'createUnit("knot", {definition: "0.514444444 m/s", aliases: ["knots", "kt", "kts"]})',
    'createUnit("mph", "1 mile/hour")'
  ],
  'seealso': [
    'unit', 'splitUnit'
  ]
};
