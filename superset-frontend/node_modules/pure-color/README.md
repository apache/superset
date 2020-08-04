# pure-color

[![Build Status](https://travis-ci.org/WickyNilliams/pure-color.svg)](https://travis-ci.org/WickyNilliams/pure-color)

`pure-color` is a color conversion and parsing library for the browser and node. It offers conversions between `rgb`, `hsl`, `hsv`, `hwb`, `cmyk`, `xyz`, `lab`, `lch`, `hex`. It offers parsing of `rgb(a)`, `hex` and `hsl(a)` strings.

## Installation

Install with npm:

```bash
npm install pure-color --save
```

## Structure

The library is structured to allow requiring of just the functions you need. You can also require everything if file size is not a concern (e.g. node environment).

```js
// require everything
var color = require("pure-color");

// require all conversion functions
var convert = require("pure-color/convert");
color.convert === convert;

//require all parse functions
var parse = require("pure-color/parse");
color.parse === parse;

// require individual conversion function
var rgb2hsl = require("pure-color/convert/rgb2hsl");

// require individual parse function
var parseRgb = require("pure-color/parse/rgb");
```

## API

### Conversion

The majority of conversion functions have the signature `[Number] -> [Number]`. The exceptions are `rgb2string` and `rgb2hex`, whose signature is `[Number] -> String`.

You can see all available conversions in the [`convert` directory](convert).

```js
var rgb2hsl = require("pure-color/convert/rgb2hsl");
var rgb2hex = require("pure-color/convert/rgb2hex");

rgb2hsl([255, 0, 0]); // [0, 100, 50]
rgb2hex([255, 0, 0]); // "#ff0000"
```

#### Hash

`"pure-color/convert"` exports a hash of conversion functions keyed first by the "from" space, then by the "to" space:

```js
var convert = require("pure-color/convert");

convert.rgb.hsl([1, 2, 3]);
convert["rgb"]["hsl"]([1, 2, 3]);
```

#### Notes

##### Alpha values

The conversion functions make no effort to handle alpha values. For instance:

```js
// alpha value is lost in conversion...
rgb2hsl([255, 0, 0, 0.5]) // [0, 100, 50]
```

The reason for this is two-fold:

1. Alpha value is orthogonal to color. A color with 50% opacity, is still the same color if it had 100% opacity.
2. It is not clear how alpha values should be handled in some color spaces. For instance, does alpha make sense in CMYK space?

You must make effort to preserve alpha values between conversions yourself if this is important to you.

##### Missing conversions

Any conversions that are simple compositions of other conversions have been omitted.

For example, let's imagine we wanted to convert `hsl` to `cmyk`. This function doesn't exist, but it can be trivially created by composing `hsl2rgb` and `rgb2cmyk`:

```js
var hsl2rgb = require("pure-color/convert/hsl2rgb");
var rgb2cmyk = require("pure-color/convert/rgb2cmyk");

// define a new function composing the others
function hsl2cmyk(hsl) {
  return rgb2cmyk(hsl2rgb(hsl));
}

// or use a higher-order compose function
var hsl2cmyk = compose(rgb2cmyk, hsl2rgb);
```

If there are missing conversions that cannot be achieved through composition, please raise an issue.

### Parsing

Parse functions have signature `String -> [Number]`.

A generic parsing function is available, which accepts `hsl`, `rgb`, and `hex` string formats. This always converts to `rgb` space for consistency - if you don't know what format the color is to begin with, you don't know what color space will be returned.

```js
var parse = require("pure-color/parse");

// parse is a function itself which converts hsl/rgb/hex string to `[r, g, b, a]`
parse("rgb(0, 0, 0)")     // [0, 0, 0];
parse("hsl(0, 0, 0)")     // [0, 0, 0];
parse("#000000")          // [0, 0, 0];

// it also handles alpha
parse("rgba(0, 0, 0, 1)") // [0, 0, 0, 1];
parse("hsla(0, 0, 0, 1)") // [0, 0, 0];
```

Individual parsing functions are available if you know what format you will be parsing. Note that the `hsl` parse function returns an `hsl` array, whereas `rgb` and `hex` return an `rgb` array

```js
var parse = require("pure-color/parse");
var parseHsl = require("pure-color/parse/hex");

parseHsl("hsla(0, 0, 0, 1)") // [0, 0, 0, 1]
parse.hsl("hsla(0, 0, 0, 1)") // [0, 0, 0, 1]

```

## Dependencies

No dependencies. Should work in any browser with ES5 support (which can be shimmed easily).

## Motivation

I have tried many color conversion/parsing libraries and I was not satisfied with any of them.

* They're often wrapped up in awkward object-oriented APIs
* They require that you include the entire library, when you often only want a subset of functionality

This library attempts to correct that by:

* Offering pure functions with consistent signatures
* Offer the bare minimum necessary functions
* Allow requiring of only the functions you need, reducing file size

## Contributions & Issues

_Contributions are welcome from **everyone**_.

Issues can be resolved quickest if they are descriptive and include both a reduced test case and a set of steps to reproduce. Personal help requests filed as issues will be declined.

Please clearly explain the purpose of any pull request. In lieu of a formal style guide, please follow the current coding style. Tests would be nice, but are not essential.

## License

Licensed under the [MIT License](http://www.opensource.org/licenses/mit-license.php)