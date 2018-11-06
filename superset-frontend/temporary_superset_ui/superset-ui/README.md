# @superset-ui

[![Build Status](https://img.shields.io/travis/com/apache-superset/superset-ui/master.svg?style=flat-square
)](https://travis-ci.com/apache-superset/superset-ui)
[![David](https://img.shields.io/david/dev/apache-superset/superset-ui.svg?style=flat-square)](https://david-dm.org/apache-superset/superset-ui?type=dev)

Collection of packages that power the Apache Superset UI, and can be used to craft custom data
applications that leverage a Superset backend :chart_with_upwards_trend:

## Packages

| Package | Version |
|--|--|
| [@superset-ui/chart](https://github.com/apache-superset/superset-ui/tree/master/packages/superset-ui-chart) | [![Version](https://img.shields.io/npm/v/@superset-ui/chart.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/chart.svg?style=flat-square) |
| [@superset-ui/color](https://github.com/apache-superset/superset-ui/tree/master/packages/superset-ui-color) | [![Version](https://img.shields.io/npm/v/@superset-ui/color.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/color.svg?style=flat-square) |
| [@superset-ui/connection](https://github.com/apache-superset/superset-ui/tree/master/packages/superset-ui-connection) | [![Version](https://img.shields.io/npm/v/@superset-ui/connection.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/connection.svg?style=flat-square) |
| [@superset-ui/core](https://github.com/apache-superset/superset-ui/tree/master/packages/superset-ui-core) | [![Version](https://img.shields.io/npm/v/@superset-ui/core.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/core.svg?style=flat-square) |
| [@superset-ui/translation](https://github.com/apache-superset/superset-ui/tree/master/packages/superset-ui-translation) | [![Version](https://img.shields.io/npm/v/@superset-ui/translation.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/translation.svg?style=flat-square) |

#### Coming :soon:

- Data providers
- Embeddable charts
- Chart collections
- Demo storybook package

### Development

[lerna](https://github.com/lerna/lerna/) is used to manage versions and dependencies between
packages in this monorepo.

```
superset-ui/
  lerna.json
  package.json
  ...
  packages/
    package1/
      package.json
      ...
      src/
      test/
      ...
      lib/
      esm/
      ...
    ...
```

### Installation

1. clone this repo
2. have lerna install package dependencies and manage the symlinking between packages for you

```sh
git clone ...superset-ui && cd superset-ui
npm install
npm run bootstrap
```

### Builds, linting, and testing

Each package defines its own build config, linting, and testing. You can have lerna run commands
across all packages using the syntax `npm run test` (or `npm run test:watch` for watch mode) from the root `@superset/monorepo` root
directory.

### Publishing

```
npm run release
```

### License

Apache-2.0
