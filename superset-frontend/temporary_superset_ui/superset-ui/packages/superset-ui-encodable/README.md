## @superset-ui/encodable

[![Version](https://img.shields.io/npm/v/@superset-ui/encodable.svg?style=flat)](https://img.shields.io/npm/v/@superset-ui/encodable.svg?style=flat)
[![David (path)](https://img.shields.io/david/apache-superset/superset-ui.svg?path=packages%2Fsuperset-ui-encodable&style=flat-square)](https://david-dm.org/apache-superset/superset-ui?path=packages/superset-ui-encodable)

This package provides standardized API for encodable components and adopts the grammar from `vega-lite` grammar and copy their logic for determining  smart defaults (e.g. choosing scale type based on data type, etc.)
In addition, it leverages sibling `superset-ui` packages to use the number and time formatters as well as color scales.

#### Example usage

```js
import { xxx } from '@superset-ui/encodable';
```

#### API

`fn(args)`

- Do something

### Development

`@data-ui/build-config` is used to manage the build configuration for this package including babel
builds, jest testing, eslint, and prettier.
