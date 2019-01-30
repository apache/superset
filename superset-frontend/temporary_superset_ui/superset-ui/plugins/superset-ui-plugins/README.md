# @superset-ui/legacy-*

[![Codecov branch](https://img.shields.io/codecov/c/github/apache-superset/superset-ui-legacy/master.svg?style=flat-square)](http://codecov.io/github/apache-superset/superset-ui-legacy/coverage.svg?branch=master)
[![Build Status](https://img.shields.io/travis/com/apache-superset/superset-ui-legacy/master.svg?style=flat-square
)](https://travis-ci.com/apache-superset/superset-ui-legacy)
[![David](https://img.shields.io/david/dev/apache-superset/superset-ui-legacy.svg?style=flat-square)](https://david-dm.org/apache-superset/superset-ui-legacy?type=dev)

Collection of packages that are extracted from classic [Apache Superset](https://github.com/apache/incubator-superset) and converted into plugins.
These packages are extracted with minimal changes (almost as-is).

## Packages

| Package | Version |
|--|--|
| [@superset-ui/legacy-plugin-chart-chord](https://github.com/apache-superset/superset-ui-legacy/tree/master/packages/superset-ui-legacy-plugin-chart-chord) | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-chord.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-chord.svg?style=flat-square) |
| [@superset-ui/legacy-plugin-chart-force-directed](https://github.com/apache-superset/superset-ui-legacy/tree/master/packages/superset-ui-legacy-plugin-chart-force-directed) | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-force-directed.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-force-directed.svg?style=flat-square) |
| [@superset-ui/legacy-plugin-chart-iframe](https://github.com/apache-superset/superset-ui-legacy/tree/master/packages/superset-ui-legacy-plugin-chart-iframe) | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-iframe.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-iframe.svg?style=flat-square) |
| [@superset-ui/legacy-plugin-chart-markup](https://github.com/apache-superset/superset-ui-legacy/tree/master/packages/superset-ui-legacy-plugin-chart-markup) | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-markup.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-markup.svg?style=flat-square) |

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
git clone ...superset-ui-legacy && cd superset-ui-legacy
yarn install
yarn build
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
