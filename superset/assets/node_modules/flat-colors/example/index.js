// Dependencies
var FlatColors = require("../lib")

// Get the flat red
console.log(FlatColors(255, 0, 0));
// => [211, 84, 0]

// Same thing, but using a rgb array
console.log(FlatColors([255, 0, 0]));
// => [211, 84, 0]


// Still same color but using hex color
console.log(FlatColors("#f00"));
// => [211, 84, 0]

// Random flat color
console.log(FlatColors());
// => [?, ?, ?]
