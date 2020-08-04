<img align="right" src="https://uber.github.io/img/h3Logo-color.svg" alt="H3 Logo" width="200">

# h3-js

[![H3 Version](https://img.shields.io/badge/h3_api-v{{h3Version}}-blue.svg)](https://github.com/uber/h3/releases/tag/v{{h3Version}}) [![Build Status](https://travis-ci.com/uber/h3-js.svg?branch=master)](https://travis-ci.com/uber/h3-js) [![Coverage Status](https://coveralls.io/repos/github/uber/h3-js/badge.svg?branch=master)](https://coveralls.io/github/uber/h3-js?branch=master)

The `h3-js` library provides a pure-JavaScript version of the [H3 Core Library](https://github.com/uber/h3), a hexagon-based geographic grid system. It can be used either in Node >= 6 or in the browser. The core library is transpiled from C using [emscripten](http://kripken.github.io/emscripten-site), offering full parity with the C API and highly efficient operations.

For more information on H3 and for the full API documentation, please see the [H3 Documentation](https://uber.github.io/h3/).

-   Post **bug reports or feature requests** to the [Github Issues page](https://github.com/uber/h3-js/issues)
-   Ask **questions** by posting to the [H3 tag on StackOverflow](https://stackoverflow.com/questions/tagged/h3)

## Install

    npm install h3-js

## Usage

The library uses ES6 modules. Bundles for Node and the browser are built to the `dist` folder.

### Import

ES6 usage:

```js
import {h3ToGeo} from "h3-js";
```

CommonJS usage:

```js
const h3 = require("h3-js");
```

Pre-bundled script (library is available as an `h3` global):

```html
<script src="https://unpkg.com/h3-js"></script>
```

### Core functions

```js
// Convert a lat/lng point to a hexagon index at resolution 7
const h3Index = h3.geoToH3(37.3615593, -122.0553238, 7);
// -> '87283472bffffff'

// Get the center of the hexagon
const hexCenterCoordinates = h3.h3ToGeo(h3Index);
// -> [37.35171820183272, -122.05032565263946]

// Get the vertices of the hexagon
const hexBoundary = h3.h3ToGeoBoundary(h3Index);
// -> [ [37.341099093235684, -122.04156135164334 ], ...]
```

### Useful algorithms

```js
// Get all neighbors within 1 step of the hexagon
const kRing = h3.kRing(h3Index, 1);
// -> ['87283472bffffff', '87283472affffff', ...]

// Get the set of hexagons within a polygon
const polygon = [
    [37.813318999983238, -122.4089866999972145],
    [37.7198061999978478, -122.3544736999993603],
    [37.8151571999998453, -122.4798767000009008]
];
const hexagons = h3.polyfill(polygon, 7);
// -> ['872830828ffffff', '87283082effffff', ...]

// Get the outline of a set of hexagons, as a GeoJSON-style MultiPolygon
const coordinates = h3.h3SetToMultiPolygon(hexagons, true);
// -> [[[
//      [-122.37681938644465, 37.76546768434345],
//      [-122.3856345540363,37.776004200673846],
//      ...
//    ]]]
```

## API Reference

{{>main}}

## Development

The `h3-js` library uses `yarn` as the preferred package manager. To install the dev dependencies, just run:

    yarn

To lint the code:

    yarn lint

To run the tests:

    yarn test

Code must be formatted with `prettier`; unformatted code will fail the build. To format all files:

    yarn prettier

### Benchmarks

The `h3-js` library includes a basic benchmark suite using [Benchmark.js](https://benchmarkjs.com/). Because many of the functions may be called over thousands of hexagons in a "hot loop", performance is an important concern. Benchmarks are run against the transpiled ES5 code by default.

To run the benchmarks in Node:

    yarn benchmark-node

To run the benchmarks in a browser:

    yarn benchmark-browser

Sample Node output (Macbook Pro running Node 6):

```
h3IsValid x 3,725,046 ops/sec ±0.47% (90 runs sampled)
geoToH3 x 227,458 ops/sec ±0.84% (89 runs sampled)
h3ToGeo x 843,167 ops/sec ±0.96% (87 runs sampled)
h3ToGeoBoundary x 220,797 ops/sec ±2.56% (86 runs sampled)
kRing x 144,955 ops/sec ±3.06% (85 runs sampled)
polyfill x 9,291 ops/sec ±1.12% (88 runs sampled)
h3SetToMultiPolygon x 311 ops/sec ±1.56% (82 runs sampled)
compact x 1,336 ops/sec ±4.51% (86 runs sampled)
uncompact x 574 ops/sec ±0.91% (85 runs sampled)
h3IndexesAreNeighbors x 670,031 ops/sec ±1.36% (88 runs sampled)
getH3UnidirectionalEdge x 356,089 ops/sec ±1.17% (85 runs sampled)
getOriginH3IndexFromUnidirectionalEdge x 1,052,652 ops/sec ±0.54% (89 runs sampled)
getDestinationH3IndexFromUnidirectionalEdge x 891,680 ops/sec ±0.90% (91 runs sampled)
h3UnidirectionalEdgeIsValid x 3,551,111 ops/sec ±0.69% (85 runs sampled)
```

When making code changes that may affect performance, please run benchmarks against `master` and then against your branch to identify any regressions.

### Transpiling the C Source

The core library is transpiled using [emscripten](http://kripken.github.io/emscripten-site). The easiest way to build from source locally is by using Docker. Make sure Docker is installed, then:

    yarn docker-boot
    yarn build-emscripten

The build script uses the `H3_VERSION` file to determine the version of the core library to build. To use a different version of the library (e.g. to test local changes), clone the desired H3 repo to `./h3c` and then run `yarn docker-emscripten`.

## Contributing

Pull requests and [Github issues](https://github.com/uber/h3-js/issues) are welcome. Please include tests for new work, and keep the library test coverage at 100%. Please note that the purpose of this module is to expose the API of the [H3 Core library](https://github.com/uber/h3), so we will rarely accept new features that are not part of that API. New proposed feature work is more appropriate in the core C library or in a new JS library that depends on `h3-js`.

Before we can merge your changes, you must agree to the [Uber Contributor License Agreement](http://cla-assistant.io/uber/h3-js).

## Versioning

The [H3 core library](https://github.com/uber/h3) adheres to [Semantic Versioning](http://semver.org/). The `h3-js` library has a `major.minor.patch` version scheme. The major and minor version numbers of `h3-js` are the major and minor version of the bound core library, respectively. The patch version is incremented independently of the core library.

## Legal and Licensing

The `h3-js` library is licensed under the [Apache 2.0 License](https://github.com/uber/h3-js/blob/master/LICENSE).

DGGRID Copyright (c) 2015 Southern Oregon University
