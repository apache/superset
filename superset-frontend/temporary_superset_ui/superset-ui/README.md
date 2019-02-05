# @superset-ui

[![Codecov branch](https://img.shields.io/codecov/c/github/apache-superset/superset-ui/master.svg?style=flat-square)](http://codecov.io/github/apache-superset/superset-ui/coverage.svg?branch=master)
[![Build Status](https://img.shields.io/travis/com/apache-superset/superset-ui/master.svg?style=flat-square
)](https://travis-ci.com/apache-superset/superset-ui)
[![David](https://img.shields.io/david/dev/apache-superset/superset-ui.svg?style=flat-square)](https://david-dm.org/apache-superset/superset-ui?type=dev)

Collection of packages that power the [Apache Superset](https://github.com/apache/incubator-superset) UI, and can be used to craft custom data
applications that leverage a Superset backend :chart_with_upwards_trend:

## Packages

| Package | Version |
|--|--|
| [@superset-ui/chart](https://github.com/apache-superset/superset-ui/tree/master/packages/superset-ui-chart) | [![Version](https://img.shields.io/npm/v/@superset-ui/chart.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/chart.svg?style=flat-square) |
| [@superset-ui/color](https://github.com/apache-superset/superset-ui/tree/master/packages/superset-ui-color) | [![Version](https://img.shields.io/npm/v/@superset-ui/color.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/color.svg?style=flat-square) |
| [@superset-ui/connection](https://github.com/apache-superset/superset-ui/tree/master/packages/superset-ui-connection) | [![Version](https://img.shields.io/npm/v/@superset-ui/connection.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/connection.svg?style=flat-square) |
| [@superset-ui/core](https://github.com/apache-superset/superset-ui/tree/master/packages/superset-ui-core) | [![Version](https://img.shields.io/npm/v/@superset-ui/core.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/core.svg?style=flat-square) |
| [@superset-ui/dimension](https://github.com/apache-superset/superset-ui/tree/master/packages/superset-ui-dimension) | [![Version](https://img.shields.io/npm/v/@superset-ui/dimension.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/dimension.svg?style=flat-square) |
| [@superset-ui/generator-superset](https://github.com/apache-superset/superset-ui/tree/master/packages/superset-ui-generator-superset) | [![Version](https://img.shields.io/npm/v/@superset-ui/generator-superset.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/generator-superset.svg?style=flat-square) |
| [@superset-ui/number-format](https://github.com/apache-superset/superset-ui/tree/master/packages/superset-ui-number-format) | [![Version](https://img.shields.io/npm/v/@superset-ui/number-format.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/number-format.svg?style=flat-square) |
| [@superset-ui/time-format](https://github.com/apache-superset/superset-ui/tree/master/packages/superset-ui-time-format) | [![Version](https://img.shields.io/npm/v/@superset-ui/time-format.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/time-format.svg?style=flat-square) |
| [@superset-ui/translation](https://github.com/apache-superset/superset-ui/tree/master/packages/superset-ui-translation) | [![Version](https://img.shields.io/npm/v/@superset-ui/translation.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/translation.svg?style=flat-square) |

#### Coming :soon:

- Data providers
- Embeddable charts
- Chart collections

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
2. have yarn install package dependencies and manage the symlinking between packages for you

```sh
git clone ...superset-ui && cd superset-ui
yarn install
```

### Builds, linting, and testing

Each package defines its own build config, linting, and testing. You can have lerna run commands
across all packages using the syntax `yarn run test` (or `yarn run test:watch` for watch mode) from the root `@superset-ui` directory.

### Publishing

**Prerequisite:** You'll need an [npmjs.com](https://npmjs.com) account that is part of the `superset-ui` organization.

1. Make sure you're logged in to NPM from your shell. Run `npm login` if necessary.
2. To make the release, run `yarn run release` and follow the prompts.

### License

Apache-2.0
