// load math.js (using node.js)
var math = require('../index');

// serialize a math.js data type into a JSON string
var x = math.complex('2+3i');
var str1 = JSON.stringify(x);
console.log(str1);
// outputs {"mathjs":"Complex","re":2,"im":3}

// deserialize a JSON string into a math.js data type
// note that the reviver of math.js is needed for this:
var str2 = '{"mathjs":"Unit","value":5,"unit":"cm"}';
var y = JSON.parse(str2, math.json.reviver);
console.log(math.typeof(y));  // 'Unit'
console.log(y.toString());    // 5 cm
