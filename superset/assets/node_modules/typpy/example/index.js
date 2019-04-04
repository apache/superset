// Dependencies
var Typpy = require("../lib");

console.log(Typpy(0));
// => "number"

console.log(Typpy(""));
// => "string"

console.log(Typpy(null));
// => "null"

console.log(Typpy([]));
// => "array"

console.log(Typpy({}));
// => "object"
