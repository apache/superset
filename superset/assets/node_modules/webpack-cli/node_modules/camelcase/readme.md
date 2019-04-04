# camelcase [![Build Status](https://travis-ci.org/sindresorhus/camelcase.svg?branch=master)](https://travis-ci.org/sindresorhus/camelcase)

> Convert a dash/dot/underscore/space separated string to camelCase or PascalCase: `foo-bar` → `fooBar`


## Install

```
$ npm install camelcase
```


## Usage

```js
const camelCase = require('camelcase');

camelCase('foo-bar');
//=> 'fooBar'

camelCase('foo_bar');
//=> 'fooBar'

camelCase('Foo-Bar');
//=> 'fooBar'

camelCase('Foo-Bar', {pascalCase: true});
//=> 'FooBar'

camelCase('--foo.bar', {pascalCase: false});
//=> 'fooBar'

camelCase('foo bar');
//=> 'fooBar'

console.log(process.argv[3]);
//=> '--foo-bar'
camelCase(process.argv[3]);
//=> 'fooBar'

camelCase(['foo', 'bar']);
//=> 'fooBar'

camelCase(['__foo__', '--bar'], {pascalCase: true});
//=> 'FooBar'
```


## API

### camelCase(input, [options])

#### input

Type: `string` `string[]`

String to convert to camel case.

#### options

Type: `Object`

##### pascalCase

Type: `boolean`<br>
Default: `false`

Uppercase the first character: `foo-bar` → `FooBar`


## Related

- [decamelize](https://github.com/sindresorhus/decamelize) - The inverse of this module
- [uppercamelcase](https://github.com/SamVerschueren/uppercamelcase) - Like this module, but to PascalCase instead of camelCase
- [titleize](https://github.com/sindresorhus/titleize) - Capitalize every word in string
- [humanize-string](https://github.com/sindresorhus/humanize-string) - Convert a camelized/dasherized/underscored string into a humanized one


## License

MIT © [Sindre Sorhus](https://sindresorhus.com)
