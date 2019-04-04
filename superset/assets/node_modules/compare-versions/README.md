# compare-versions

[![Build Status](https://img.shields.io/travis/omichelsen/compare-versions/master.svg)](https://travis-ci.org/omichelsen/compare-versions)
[![Coverage Status](https://coveralls.io/repos/omichelsen/compare-versions/badge.svg?branch=master&service=github)](https://coveralls.io/github/omichelsen/compare-versions?branch=master)
[![npm bundle size (minified + gzip)](https://img.shields.io/bundlephobia/minzip/compare-versions.svg)](https://bundlephobia.com/result?p=compare-versions)

Compare [semver](https://semver.org/) version strings to find greater, equal or lesser. Runs in the browser as well as Node.js/React Native etc. Has no dependencies and is tiny (~630 bytes gzipped).

This library supports the full semver specification, including comparing versions with different number of digits like `1.0.0`, `1.0`, `1`, and pre-release versions like `1.0.0-alpha`. Additionally supports the following variations:

- Supports wildcards for minor and patch version like `1.0.x` or `1.0.*`.
- Supports [Chromium version numbers](https://www.chromium.org/developers/version-numbers) with 4 parts, e.g. version `25.0.1364.126`.
- Any leading `v` is ignored, e.g. `v1.0` is interpreted as `1.0`.
- Leading zero is ignored, e.g. `1.01.1` is interpreted as `1.1.1`.

## Install

```bash
$ npm install compare-versions
```

## Usage

### Import

```javascript
// ES6/TypeScript
import * as compareVersions from 'compare-versions';

// Node
var compareVersions = require('compare-versions');
```

### Compare

```javascript
compareVersions('10.1.8', '10.0.4'); //  1
compareVersions('10.0.1', '10.0.1'); //  0
compareVersions('10.1.1', '10.2.2'); // -1
```

Can also be used for sorting:

```javascript
var versions = [
  '1.5.19',
  '1.2.3',
  '1.5.5'
]
var sorted = versions.sort(compareVersions);
/*
[
  '1.2.3',
  '1.5.5',
  '1.5.19'
]
*/
```

### Browser

If included directly in the browser, `compareVersions()` is available on the global window:

```html
<script src="compare-versions/index.js"></script>
<script>
  window.compareVersions('10.0.0', '10.1.0');
</script>
```
