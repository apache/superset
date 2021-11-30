# @superset-ui/plugins-deckgl 🔌💡

[![Codecov branch](https://img.shields.io/codecov/c/github/apache-superset/superset-ui-plugins-deckgl/master.svg?style=flat-square)](https://codecov.io/gh/apache-superset/superset-ui-plugins-deckgl/branch/master)
[![Build Status](https://img.shields.io/travis/com/apache-superset/superset-ui-plugins-deckgl/master.svg?style=flat-square)](https://travis-ci.com/apache-superset/superset-ui-plugins-deckgl)
[![David](https://img.shields.io/david/dev/apache-superset/superset-ui-plugins-deckgl.svg?style=flat-square)](https://david-dm.org/apache-superset/superset-ui-plugins-deckgl?type=dev)
[![Netlify Status](https://api.netlify.com/api/v1/badges/4d054ead-0e76-4e03-b684-797ca5924161/deploy-status)](https://app.netlify.com/sites/superset-ui-plugins-deckgl/deploys)

## Demo (Storybook)

Most recent release: https://apache-superset.github.io/superset-ui-plugins-deckgl/

Current master: https://superset-ui-plugins-deckgl.netlify.com

## Packages

| Package                                                                                                                                                              | Version                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [@superset-ui/legacy-preset-chart-deckgl](https://github.com/apache-superset/superset-ui-plugins-deckgl/tree/master/packages/superset-ui-legacy-preset-chart-deckgl) | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-preset-chart-deckgl.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/legacy-preset-chart-deckgl.svg?style=flat-square) |

## Contribution and development guide

Please read the
[contributing guidelines](https://github.com/apache-superset/superset-ui/blob/master/CONTRIBUTING.md)
which include development environment setup and other things you should know about coding in this
repo.

### Releasing

Make sure you have commit rights to the main `superset-ui-plugins-deckgl` repo, have checked it out
(NOT a fork!) and belong to the `superset-ui` org on npm (=can publish new versions).

1. `yarn install`
2. `yarn build`
3. `yarn release-patch-version`. This will raise an error, but you should see a new commit and tag,
   e.g. `v0.4.8`
4. go to the DeckGL directory: `cd packages/superset-ui-legacy-preset-chart-deckgl`
5. make sure you're logged into npm: `npm whoami` should display your npm username.
6. `npm publish`

### License

Apache-2.0
