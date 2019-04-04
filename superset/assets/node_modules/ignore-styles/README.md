# ignore-styles

[![Version][version-svg]][package-url] [![Build Status][travis-svg]][travis-url] [![License][license-image]][license-url] [![Downloads][downloads-image]][downloads-url] [![Standard][standard-svg]][standard-url]

A `babel/register` style hook to ignore style imports when running in Node. This
is for projects that use something like Webpack to enable CSS imports in
JavaScript. When you try to run the project in Node (to test in Mocha, for
example) you'll see errors like this:

    SyntaxError: /Users/brandon/code/my-project/src/components/my-component/style.sass: Unexpected token (1:0)
    > 1 | .title
    | ^
    2 |   font-family: serif
    3 |   font-size: 10em
    4 |

To resolve this, require `ignore-styles` with your mocha tests:

    mocha --require ignore-styles

See [DEFAULT_EXTENSIONS][default-extensions] for the full list of extensions
ignored, and send a pull request if you need more.

**Note:** This is not for use *inside* Webpack. If you want to ignore extensions in Webpack you'll want to use a loader like [ignore-loader]. This is for use in Node outside of your normal Webpack build.

## Installation

    $ npm install --save-dev ignore-styles

## More Examples

To use this with multiple Mocha requires:

    mocha --require babel-register --require ignore-styles

You can also use it just like `babel/register`:

```js
import 'ignore-styles'
```

In ES5:

```js
require('ignore-styles')
```

To customize the extensions used:

```js
import register from 'ignore-styles'
register(['.sass', '.scss'])
```

To customize the extensions in ES5:

```js
require('ignore-styles').default(['.sass', '.scss']);
```

## Custom handler

By default, a no-op handler is used that doesn't actually do anything. If you'd
like to substitute your own custom handler to do fancy things, pass it as a
second argument:

```js
import register from 'ignore-styles'
register(undefined, () => ({styleName: 'fake_class_name'}))
```

The first argument to `register` is the list of extensions to handle. Leaving it
undefined, as above, uses the default list. The handler function receives two arguments, `module` and `filename`, directly
from Node.

Why is this useful? One example is when using something like
[react-css-modules][react-css-modules]. You need the style imports to actually
return something so that you can test the components, or the wrapper component
will throw an error. Use this to provide test class names.

Another use case would be to simply return the filename of an image so that it
can be verified in unit tests:

```js
const _ = require('lodash');
const path = require('path');

register(undefined, (module, filename) => {
  if (_.some(['.png', '.jpg'], ext => filename.endsWith(ext))) {
    module.exports = path.basename(filename);
  }
})
```

If the filename ends in '.png' or '.jpg', then the basename of the file is
returned as the value of the module on import.

## License

The MIT License (MIT)

Copyright (c) 2015 Brainspace Corporation

[travis-svg]: https://img.shields.io/travis/bkonkle/ignore-styles/master.svg?style=flat-square
[travis-url]: https://travis-ci.org/bkonkle/ignore-styles
[license-image]: http://img.shields.io/badge/license-MIT-green.svg?style=flat-square
[license-url]: LICENSE
[downloads-image]: https://img.shields.io/npm/dm/ignore-styles.svg?style=flat-square
[downloads-url]: http://npm-stat.com/charts.html?package=ignore-styles
[version-svg]: https://img.shields.io/npm/v/ignore-styles.svg?style=flat-square
[package-url]: https://npmjs.org/package/ignore-styles
[standard-svg]: https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square
[standard-url]: http://standardjs.com/
[default-extensions]: https://github.com/bkonkle/ignore-styles/blob/master/ignore-styles.js#L1
[react-css-modules]: https://github.com/gajus/react-css-modules
[ignore-loader]: https://www.npmjs.com/package/ignore-loader
