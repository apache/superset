# css-url-regex [![Build Status](https://travis-ci.org/cssstats/css-url-regex.svg?branch=master)](https://travis-ci.org/johnotander/css-url-regex) [![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](https://github.com/feross/standard)

A regular expression for matching CSS urls, `url(foo.css)`.

## Installation

```
npm i --save css-url-regex
```

## Usage

```javascript
var cssUrl = require('css-url-regex')

cssUrl().test('url(bar.css)') // => true
cssUrl().test('kljhsdf') // => false
```

## License

MIT

## Contributing

1. Fork it
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create new Pull Request

Crafted with <3 by [John Otander](http://johnotander.com).
