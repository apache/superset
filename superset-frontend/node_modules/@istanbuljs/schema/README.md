# @istanbuljs/schema

[![Travis CI][travis-image]][travis-url]
[![Greenkeeper badge][gk-image]](https://greenkeeper.io/)
[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![MIT][license-image]](LICENSE)

Schemas describing various structures used by nyc and istanbuljs

## Usage

```js
const {nyc} = require('@istanbuljs/schema').defaults;

console.log(`Default exclude list:\n\t* ${nyc.exclude.join('\n\t* ')}`);
```

[npm-image]: https://img.shields.io/npm/v/@istanbuljs/schema.svg
[npm-url]: https://npmjs.org/package/@istanbuljs/schema
[travis-image]: https://travis-ci.org/istanbuljs/schema.svg?branch=master
[travis-url]: https://travis-ci.org/istanbuljs/schema
[gk-image]: https://badges.greenkeeper.io/istanbuljs/schema.svg
[downloads-image]: https://img.shields.io/npm/dm/@istanbuljs/schema.svg
[downloads-url]: https://npmjs.org/package/@istanbuljs/schema
[license-image]: https://img.shields.io/npm/l/@istanbuljs/schema.svg
