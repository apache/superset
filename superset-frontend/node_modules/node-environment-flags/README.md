# node-environment-flags

> Polyfill/shim for `process.allowedNodeEnvironmentFlags`

[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

**node-environment-flags** is a *rough* polyfill and shim for [process.allowedNodeEnvironmentFlags](https://nodejs.org/api/process.html#process_process_allowednodeenvironmentflags), which was introduced in Node.js v10.10.0.

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [Maintainers](#maintainers)
- [Contribute](#contribute)
- [License](#license)

## Install

*Requires Node.js v6.0.0 or newer.*

```shell
$ npm i node-environment-flags
```

## Usage

If the current Node.js version is v10.10.0 or newer, the native implementation will be provided instead.

### As Polyfill (Recommended)

```js
const nodeEnvironmentFlags = require('node-environment-flags');

nodeEnvironmentFlags.has('--require'); // true
```

### As Shim

```js
require('node-environment-flags/shim')();

process.allowedNodeEnvironmentFlags.has('--require'); // true
```

## Notes

- This module approximates what `process.allowedNodeEnvironmentFlags` provides in versions of Node.js prior to v10.10.0.  Since `process.allowedNodeEnvironmentFlags` is based on [`NODE_OPTIONS`](https://nodejs.org/api/cli.html#cli_node_options_options) (introduced in v8.0.0), the set of supported flags for versions older than v8.0.0 is *highly theoretical*.
- Version ranges are matched using [semver](https://npm.im/semver).
- This module is granular to the *minor* Node.js version number; *patch* version numbers are not considered.
- Results for unmaintained (odd) versions of Node.js are based on data for the most recent LTS version; e.g., running this module against Node.js v7.10.0 will yield the same results as would v6.14.0.
- Prior art: @ljharb's [util.promisify](https://npm.im/util.promisify)

## Maintainers

[@boneskull](https://github.com/boneskull)

## License

Copyright © 2018 Christopher Hiller.  Licensed Apache-2.0.
