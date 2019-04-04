[![couleurs](http://i.imgur.com/W3rh7oh.png)](#)

# couleurs [![PayPal](https://img.shields.io/badge/%24-paypal-f39c12.svg)][paypal-donations] [![Travis](https://img.shields.io/travis/IonicaBizau/node-couleurs.svg)](https://travis-ci.org/IonicaBizau/node-couleurs/) [![Version](https://img.shields.io/npm/v/couleurs.svg)](https://www.npmjs.com/package/couleurs) [![Downloads](https://img.shields.io/npm/dt/couleurs.svg)](https://www.npmjs.com/package/couleurs) [![Get help on Codementor](https://cdn.codementor.io/badges/get_help_github.svg)](https://www.codementor.io/johnnyb?utm_source=github&utm_medium=button&utm_term=johnnyb&utm_campaign=github)

> Add some color and styles to your Node.JS strings.

[![couleurs](http://i.imgur.com/M1D9mxT.png)](#)

## Installation

```sh
$ npm i --save couleurs
```

## Example

```js
// Dependencies
var Couleurs = require("couleurs")
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
```

## Documentation

### `Couleurs(setStringProto, fg)`

#### Params
- **Boolean** `setStringProto`: If `true`, the prototype of String class will be modified.
- **String|Array** `fg`: An optional foreground color.

#### Return
- **String|Object** The colored string if the `fg` argument was provided or an object containing the following methods:

 - `proto`
 - `toString`
 - `fg`
 - `bg`
 - `bold`
 - `italic`
 - `underline`
 - `inverse`
 - `strike`

### `hexToRgb(hex)`
Couleurs.hexToRgb
Converts a hex color code to rgb

#### Params
- **String** `hex`: The hex color value.

#### Return
- **Array** An array containing `r`, `g`, `b` values. If the input is invalid, `null` will be returned.

### `toString()`
Converts the internal object into string.

#### Return
- **String** Stringifies the couleurs internal data using ANSI styles.

### `proto()`
Modifies the `String` prototype to contain the `Couleurs` methods.

## How to contribute
Have an idea? Found a bug? See [how to contribute][contributing].

## Where is this library used?
If you are using this library in one of your projects, add it in this list. :sparkles:

 - [`asciify-image`](https://github.com/ajay-gandhi/asciify-image) by Ajay Gandhi

 - [`bible`](https://github.com/BibleJS/BibleApp)

 - [`birthday`](https://github.com/IonicaBizau/birthday)

 - [`bloggify`](https://github.com/Bloggify/bloggify-tools)

 - [`bug-killer`](https://github.com/IonicaBizau/node-bug-killer)

 - [`cli-gh-cal`](https://github.com/IonicaBizau/cli-gh-cal)

 - [`cli-github`](https://github.com/IonicaBizau/cli-github)

 - [`cli-pie`](https://github.com/IonicaBizau/node-cli-pie)

 - [`cli-sunset`](https://github.com/IonicaBizau/cli-sunset)

 - [`closeheat`](https://github.com/closeheat/cli) by Domas Bitvinskas

 - [`color-it`](https://github.com/IonicaBizau/node-color-it#readme)

 - [`csk-cli`](https://github.com/joshumax/csk-cli) by Josh Max

 - [`fb-falafel`](https://fb-falafel.ml) by Ajay and Kevin

 - [`git-issues`](https://github.com/softwarescales/git-issues) by Gabriel Petrovay

 - [`git-issues1`](https://github.com/softwarescales/git-issues) by Gabriel Petrovay

 - [`git-stats-colors`](https://github.com/IonicaBizau/node-git-stats-colors)

 - [`github-emojify`](https://github.com/IonicaBizau/github-emojifiy#readme)

 - [`github-stats`](https://github.com/IonicaBizau/github-stats)

 - [`idea`](https://github.com/IonicaBizau/idea)

 - [`image-to-ascii`](https://github.com/IonicaBizau/image-to-ascii)

 - [`overlap`](https://github.com/IonicaBizau/node-overlap)

 - [`tithe`](https://github.com/IonicaBizau/tithe)

## License

[MIT][license] © [Ionică Bizău][website]

[paypal-donations]: https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=RVXDDLKKLQRJW
[donate-now]: http://i.imgur.com/6cMbHOC.png

[license]: http://showalicense.com/?fullname=Ionic%C4%83%20Biz%C4%83u%20%3Cbizauionica%40gmail.com%3E%20(http%3A%2F%2Fionicabizau.net)&year=2014#license-mit
[website]: http://ionicabizau.net
[contributing]: /CONTRIBUTING.md
[docs]: /DOCUMENTATION.md