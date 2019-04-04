# hoist-non-react-statics

[![NPM version](https://badge.fury.io/js/hoist-non-react-statics.svg)](http://badge.fury.io/js/hoist-non-react-statics)
[![Build Status](https://img.shields.io/travis/mridgway/hoist-non-react-statics.svg)](https://travis-ci.org/mridgway/hoist-non-react-statics)
[![Coverage Status](https://img.shields.io/coveralls/mridgway/hoist-non-react-statics.svg)](https://coveralls.io/r/mridgway/hoist-non-react-statics?branch=master)
[![Dependency Status](https://img.shields.io/david/mridgway/hoist-non-react-statics.svg)](https://david-dm.org/mridgway/hoist-non-react-statics)
[![devDependency Status](https://img.shields.io/david/dev/mridgway/hoist-non-react-statics.svg)](https://david-dm.org/mridgway/hoist-non-react-statics#info=devDependencies)

Copies non-react specific statics from a child component to a parent component. 
Similar to `Object.assign`, but with React static keywords blacklisted from
being overridden.

```bash
$ npm install --save hoist-non-react-statics
```

## Usage

```js
import hoistNonReactStatic from 'hoist-non-react-statics';

hoistNonReactStatic(targetComponent, sourceComponent);
```

## Compatible React Versions

| Compatible React Version | hoist-non-react-statics Version |
|--------------------------|-------------------------------|
| 0.13-15.0 | >= 1.0.0 |

## License
This software is free to use under the Yahoo Inc. BSD license.
See the [LICENSE file][] for license text and copyright information.

[LICENSE file]: https://github.com/mridgway/hoist-non-react-statics/blob/master/LICENSE.md

Third-party open source code used are listed in our [package.json file]( https://github.com/mridgway/hoist-non-react-statics/blob/master/package.json).
