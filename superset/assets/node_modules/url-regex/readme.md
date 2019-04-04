# url-regex [![Build Status](http://img.shields.io/travis/kevva/url-regex.svg?style=flat)](https://travis-ci.org/kevva/url-regex)

> Regular expression for matching URLs

Based on this [gist](https://gist.github.com/dperini/729294) by Diego Perini.


## Install

```
$ npm install --save url-regex
```


## Usage

```js
var urlRegex = require('url-regex');

urlRegex().test('http://github.com foo bar');
//=> true

urlRegex().test('www.github.com foo bar');
//=> true

urlRegex({exact: true}).test('http://github.com foo bar');
//=> false

urlRegex({exact: true}).test('http://github.com');
//=> true

'foo http://github.com bar //google.com'.match(urlRegex());
//=> ['http://github.com', '//google.com']
```


## API

### urlRegex(options)

Returns a regex for matching URLs.

#### options

##### exact

Type: `boolean`  
Default: `false` *(Matches any URL in a string)*

Only match an exact string.  
Useful with `RegExp#test` to check if a string is a URL.


## License

MIT © [Kevin Mårtensson](https://github.com/kevva) and [Diego Perini](https://github.com/dperini)
