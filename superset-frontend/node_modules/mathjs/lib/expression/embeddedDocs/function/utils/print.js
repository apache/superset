module.exports = {
  'name': 'print',
  'category': 'Utils',
  'syntax': [
    'print(template, values)',
    'print(template, values, precision)'
  ],
  'description': 'Interpolate values into a string template.',
  'examples': [
    'print("Lucy is $age years old", {age: 5})',
    'print("The value of pi is $pi", {pi: pi}, 3)',
    'print("Hello, $user.name!", {user: {name: "John"}})'
  ],
  'seealso': ['format']
};
