// Dependencies
var Couleurs = require("../lib")
  , FlatColors = require("flat-colors")
  ;

// Basic usage using a random flat color
var colored = new Couleurs("Hello World").fg(FlatColors());
console.log(colored.toString());

// Other ways to color the strings
console.log(Couleurs.fg("Red", [255, 0, 0]));
console.log(Couleurs("Red foreground", [255, 0, 0]));
console.log(Couleurs.fg("Yellow", 255, 255, 0));
console.log(Couleurs.fg("Blue", "#2980b9"));
console.log(Couleurs.bg("Blue Background", "#2980b9"));
console.log(Couleurs("Blue & Underline").fg("#2980b9").bold().underline().toString());

console.log(Couleurs.bold("Bold"));
console.log(Couleurs.italic("Italic"));

// Modify prototype
Couleurs.proto();

console.log("Underline".underline());
console.log("Inverse".inverse());
console.log("Strikethrough".strike());

console.log("All combined"
    .fg("#d35400")
    .bold()
    .italic()
    .underline()
    .inverse()
    .strike()
);
