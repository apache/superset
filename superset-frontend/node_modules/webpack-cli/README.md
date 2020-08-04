<div align="center">
    <a href="https://github.com/webpack/webpack-cli">
        <img width="200" height="200" src="https://webpack.js.org/assets/icon-square-big.svg">
    </a>
</div>

<h1 align="center">webpack CLI</h1>

<p align="center">
  The official CLI of webpack
</p>
<br>

[![npm][npm]][npm-url]
[![Build Status][build-status]][build-status-url]
[![Build2 Status][build-status-azure]][build-status-azure-url]
[![deps][deps]][deps-url]
[![Code Climate][maintainability]][maintainability-url]
[![chat on gitter][chat]][chat-url]
[![Install Size][size]][size-url]
[![Downloads][downloads]][downloads-url]
[![lerna][lerna]][lerna-url]
[![GitHub contributors][contributors]][contributors-url]

-   [About](#about)
    -   [How to install](#how-to-install)
-   [Packages](#packages)
    -   [Commands](#commands)
    -   [Utilities](#utilities)
-   [Getting started](#getting-started)
-   [webpack CLI Scaffolds](#webpack-cli-scaffolds)
-   [Contributing and Internal Documentation](#contributing-and-internal-documentation)
-   [Open Collective](#open-collective)

## About

webpack CLI provides a flexible set of commands for developers to increase speed when setting up a custom webpack project. As of webpack v4, webpack is not expecting a configuration file, but often developers want to create a more custom webpack configuration based on their use-cases and needs. webpack CLI addresses these needs by providing a set of tools to improve the setup of custom webpack configuration.

### How to install

When you have followed the [Getting Started](https://webpack.js.org/guides/getting-started/) guide of webpack then webpack CLI is already installed!

Otherwise `npm install --save-dev webpack-cli` or `yarn add webpack-cli --dev` will install it.

## Packages

We organize webpack CLI as a multi-package repository using [lerna](https://github.com/lerna/lerna). Every command has a dedicated subfolder in the `packages` Folder. Here's a summary of commands provided by the CLI.

### Commands

Supporting developers is an important task for webpack CLI. Thus, webpack CLI provides different commands for many common tasks.

-   [`webpack-cli init`](./packages/init/README.md#webpack-cli-init) - Create a new webpack configuration.
-   [`webpack-cli info`](./packages/info/README.md#webpack-cli-info) - Returns information related to the local environment.
-   [`webpack-cli migrate`](./packages/migrate/README.md#webpack-cli-migrate) - Migrate project from one version to another.
-   [`webpack-cli generate-plugin`](./packages/generate-plugin/README.md#webpack-cli-generate-plugin) - Initiate new plugin project.
-   [`webpack-cli generate-loader`](./packages/generate-loader/README.md#webpack-cli-generate-loader) - Initiate new loader project.
-   [`webpack-cli serve`](./packages/serve/README.md#webpack-cli-serve) - Use webpack with a development server that provides live reloading.

### Utilities

The project also has several utility packages which are used by other commands

-   [`utils`](./packages/utils/README.md) - Several utilities used across webpack-cli.
-   [`generators`](./packages/generators/README.md) - Contains all webpack-cli related yeoman generators.
-   [`webpack-scaffold`](./packages/webpack-scaffold/README.md) - Utilities to create a webpack scaffold.

## Getting started

When you have followed the [Getting Started](https://webpack.js.org/guides/getting-started/) guide of webpack then webpack CLI is already installed! Otherwise, you would need to install webpack CLI and the packages you want to use. If we want to use the `init` command to create a new `webpack.config.js` configuration file:

```sh
npm i webpack-cli @webpack-cli/init
npx webpack-cli init
```

You will be prompted for some questions about what how you want to generate your config file when running the `init` command so webpack CLI can provide the best fitting configuration.

## webpack CLI Scaffolds

With v3 of webpack CLI, we introduced scaffolding as an integral part of the CLI. Our goal is to simplify the creation of webpack configurations for different purposes. Additionally, sharing such solutions with the community is beneficial and with webpack, we want to allow this. We provide `webpack-scaffold` as a utility suite for creating these scaffolds. It contains functions that could be of use for creating a scaffold yourself.

You can read more about [Scaffolding](https://webpack.js.org/guides/scaffolding), learn [How to compose a webpack-scaffold?](https://webpack.js.org/contribute/writing-a-scaffold) or generate one with [webpack-scaffold-starter](https://github.com/rishabh3112/webpack-scaffold-starter).

## Contributing and Internal Documentation

The webpack family welcomes any contributor, small or big. We are happy to elaborate, guide you through the source code and find issues you might want to work on! To get started have a look at our [documentation on contributing](./.github/CONTRIBUTING.md).

## Open Collective

If you like **webpack**, please consider donating to our [Open Collective](https://opencollective.com/webpack) to help us maintain it.

[build-status]: https://travis-ci.org/webpack/webpack-cli.svg
[build-status-url]: https://travis-ci.org/webpack/webpack-cli
[build-status-azure]: https://dev.azure.com/webpack/webpack/_apis/build/status/webpack.webpack-cli
[build-status-azure-url]: https://dev.azure.com/webpack/webpack/_build/latest?definitionId=4
[chat]: https://badges.gitter.im/webpack/webpack.svg
[chat-url]: https://gitter.im/webpack/webpack
[contributors]: https://img.shields.io/github/contributors/webpack/webpack-cli.svg
[contributors-url]: https://github.com/webpack/webpack-cli/graphs/contributors
[deps]: https://img.shields.io/david/webpack/webpack.svg
[deps-url]: https://david-dm.org/webpack/webpack-cli
[downloads]: https://img.shields.io/npm/dw/webpack-cli.svg
[downloads-url]: https://www.npmjs.com/package/webpack-cli
[lerna]: https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg
[lerna-url]: http://www.lernajs.io/
[npm]: https://img.shields.io/npm/v/webpack-cli.svg
[npm-url]: https://www.npmjs.com/package/webpack-cli
[maintainability]: https://codeclimate.com/github/webpack/webpack-cli/badges/gpa.svg
[maintainability-url]: https://codeclimate.com/github/webpack/webpack-cli
[size]: https://packagephobia.now.sh/badge?p=webpack-cli
[size-url]: https://packagephobia.now.sh/result?p=webpack-cli
