// objects

// load math.js (using node.js)
var math = require('../index');

// create an object. Keys can be symbols or strings
print(math.eval('{x: 2 + 1, y: 4}'));           // {"x": 3, "y": 4}
print(math.eval('{"name": "John"}'));           // {"name": "John"}

// create an object containing an object
print(math.eval('{a: 2, b: {c: 3, d: 4}}'));    // {"a": 2, "b": {"c": 3, "d": 4}}

var scope = {
  obj: {
    prop: 42
  }
};

// retrieve properties using dot notation or bracket notation
print(math.eval('obj.prop', scope));            // 42
print(math.eval('obj["prop"]', scope));         // 42

// set properties (returns the whole object, not the property value!)
print(math.eval('obj.prop = 43', scope));       // {"prop": 43}
print(math.eval('obj["prop"] = 43', scope));    // {"prop": 43}
print(scope.obj);                               // {"prop": 43}


/**
 * Helper function to output a value in the console. Value will be formatted.
 * @param {*} value
 */
function print (value) {
  var precision = 14;
  console.log(math.format(value, precision));
}
