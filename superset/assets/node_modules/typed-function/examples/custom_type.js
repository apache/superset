var typed = require('../typed-function');

// create a prototype
function Person(params) {
  this.name = params.name;
  this.age = params.age;
}

// register a test for this new type
typed.addType({
  name: 'Person',
  test: function (x) {
    return x instanceof Person;
  }
});

// create a typed function
var stringify = typed({
  'Person': function (person) {
    return JSON.stringify(person);
  }
});

// use the function
var person = new Person({name: 'John', age: 28});

console.log(stringify(person));
// outputs: '{"name":"John","age":28}'

// calling the function with a non-supported type signature will throw an error
try {
  stringify('ooops');
}
catch (err) {
  console.log('Wrong input will throw an error:');
  console.log('  ' + err.toString());
  // outputs: TypeError: Unexpected type of argument (expected: Person,
  //          actual: string, index: 0)
}
