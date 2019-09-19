# @superset-ui/plugins-deckgl 🔌💡

[![Codecov branch](https://img.shields.io/codecov/c/github/apache-superset/superset-ui-plugins-deckgl/master.svg?style=flat-square)](https://codecov.io/gh/apache-superset/superset-ui-plugins-deckgl/branch/master)
[![Build Status](https://img.shields.io/travis/com/apache-superset/superset-ui-plugins-deckgl/master.svg?style=flat-square
)](https://travis-ci.com/apache-superset/superset-ui-plugins-deckgl)
[![David](https://img.shields.io/david/dev/apache-superset/superset-ui-plugins-deckgl.svg?style=flat-square)](https://david-dm.org/apache-superset/superset-ui-plugins-deckgl?type=dev)
[![Netlify Status](https://api.netlify.com/api/v1/badges/d2c78390-752e-4fc2-abf0-7e6df362b9ff/deploy-status)](https://app.netlify.com/sites/superset-ui-plugins-deckgl/deploys)

## Demo (Storybook)

Most recent release: https://apache-superset.github.io/superset-ui-plugins-deckgl/

Current master: https://superset-ui-plugins-deckgl.netlify.com

## Packages

| Package | Version |
|--|--|
| [@superset-ui/legacy-preset-chart-deckgl](https://github.com/apache-superset/superset-ui-plugins-deckgl/tree/master/packages/superset-ui-legacy-preset-chart-deckgl) | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-preset-chart-deckgl.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/legacy-preset-chart-deckgl.svg?style=flat-square) |

### Development

[lerna](https://github.com/lerna/lerna/) and [yarn](https://yarnpkg.com) are used to manage versions and dependencies between
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
git clone ...superset-ui-plugins-deckgl && cd superset-ui-plugins-deckgl
yarn install
yarn build
```

### Builds, linting, and testing

Each package defines its own build config, linting, and testing. You can have lerna run commands
across all packages using the syntax `yarn run test` (or `yarn run test:watch` for watch mode) from the root `@superset-ui-plugins-deckgl` directory.

* [Using Storybook](https://github.com/apache-superset/superset-ui/blob/master/docs/storybook.md) - You can test your components independently from Superset app.
* [Debugging Superset plugins in Superset app](https://github.com/apache-superset/superset-ui/blob/master/docs/debugging.md) - Sometimes something went wrong and you have to do it.

### Committing

This repository follows [conventional commits](https://www.conventionalcommits.org/en/v1.0.0-beta.3/) guideline for commit messages and has a `commitlint` hook which will require you to have the valid commit message before committing. You can use `npm run commit` to help you create a commit message.

### Publishing

**Prerequisite:** You'll need an [npmjs.com](https://npmjs.com) account that is part of the `@superset-ui` organization.

1. Make sure you're logged in to NPM from your shell. Run `npm login` if necessary.
2. To make the release, run `yarn run release` and follow the prompts.

### License

Apache-2.0
