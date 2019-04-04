generic-names
=============

Helper for building generic names, similar to webpack. Designed to be used with [postcss&#x2011;modules&#x2011;scope](https://github.com/css-modules/postcss-modules-scope).

Uses [interpolateName](https://github.com/webpack/loader-utils#interpolatename) from the webpack/loader-utils.

## API

```javascript
var genericNames = require('generic-names');
var generate = genericNames('[name]__[local]___[hash:base64:5]', {
  context: process.cwd()
});

generate('foo', '/case/source.css'); // 'source__foo___3mRq8'
```
