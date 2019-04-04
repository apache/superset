# jest-docblock

`jest-docblock` is a package that can extract and parse a specially-formatted comment called a "docblock" at the top of a file.

A docblock looks like this:
```js
/**
 * Stuff goes here!
 */
```

Docblocks can contain pragmas, which are words prefixed by `@`:
```js
/**
 * Pragma incoming!
 *
 * @flow
 */
```

Pragmas can also take arguments:
```js
/**
 * Check this out:
 *
 * @myPragma it is so cool
 */
```

`jest-docblock` can:
* extract the docblock from some code as a string
* parse a docblock string's pragmas into an object

## Installation
```sh
# with yarn
$ yarn add jest-docblock
# with npm
$ npm install jest-docblock
```

## Usage

```js
const code = `
/**
 * Everything is awesome!
 *
 * @everything is:awesome
 * @flow
 */
 
 export const everything = Object.create(null);
 export default function isAwesome(something) {
   return something === everything;
 }
`;

const { extract, parse } = require("jest-docblock");

const docblock = extract(code);
console.log(docblock); // "/**\n * Everything is awesome!\n * \n * @everything is:awesome\n * @flow\n */"

const pragmas = parse(docblock);
console.log(pragmas); // { everything: "is:awesome", flow: "" }
```

## API Documentation

### `extract(contents: string): string`
Extracts a docblock from some file contents. Returns the docblock contained in `contents`. If `contents` did not contain a docblock, it will return the empty string (`""`).

### `parse(docblock: string): {[key: string]: string}`
Parses the pragmas in a docblock string into an object whose keys are the pragma tags and whose values are the arguments to those pragmas.
