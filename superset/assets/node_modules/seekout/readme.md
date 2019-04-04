seekout
=======

Looks for a provided file in the current directory. Also checks all parent directories and returns the first found file path.

## Installation

```bash
$ npm install seekout
```

## Usage

```javascript
const seekout = require('seekout');

seekout('.npmrc');
// "/Users/sullenor/.npmrc"
// or null if file was not found
```

You can also specify any certain working directory by the second argument.

```javascript
const seekout = require('seekout');

seekout('package.json', './seekout');
// "/../seekout/package.json"
```
