# `@superset-ui`

Collection of packages that power the Apache Superset UI, and can be used to craft custom data
applications that leverage a Superset backend :chart_with_upwards_trend:

## Packages

| Package | Version |
|--|--|
| [@superset-ui/core](https://github.com/apache-superset/superset-ui/tree/master/packages/superset-ui-core) | [![Version](https://img.shields.io/npm/v/@superset-ui/core.svg?style=flat)](https://img.shields.io/npm/v/@superset-ui/core.svg?style=flat) |
| [@superset-ui/translation](https://github.com/apache-superset/superset-ui/tree/master/packages/superset-ui-translation) | [![Version](https://img.shields.io/npm/v/@superset-ui/translation.svg?style=flat)](https://img.shields.io/npm/v/@superset-ui/translation.svg?style=flat) |

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

For easiest development

1. clone this repo
2. install the root npm modules including lerna and yarn
3. have lerna install package dependencies and manage the symlinking between packages for you

```sh
git clone ...superset-ui && cd superset-ui
npm install
lerna bootstrap
```

### Builds, linting, and testing

Each package defines its own build config, linting, and testing. You can have lerna run commands
across all packages using the syntax `lerna exec test` from the root `@superset/monorepo` root
directory.

### Publishing

```
npm run release
```

### License

Apache-2.0
