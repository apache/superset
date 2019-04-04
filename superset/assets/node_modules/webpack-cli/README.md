<div align="center">
	<a href="https://github.com/webpack/webpack-cli">
		<img width="200" height="200" src="https://webpack.js.org/assets/icon-square-big.svg">
	</a>
</div>
<p align="center">
  The official CLI of webpack
</p>
<br>

[![npm](https://img.shields.io/npm/v/webpack-cli.svg)](https://www.npmjs.com/package/webpack-cli)
[![Build Status](https://travis-ci.org/webpack/webpack-cli.svg)](https://travis-ci.org/webpack/webpack-cli)
[![Build2 Status](https://dev.azure.com/webpack/webpack/_apis/build/status/webpack.webpack-cli)](https://dev.azure.com/webpack/webpack/_build/latest?definitionId=4)
[![Dependency Status](https://david-dm.org/webpack/webpack-cli.svg)](https://david-dm.org/webpack/webpack-cli)
[![Code Climate](https://codeclimate.com/github/webpack/webpack-cli/badges/gpa.svg)](https://codeclimate.com/github/webpack/webpack-cli)
[![chat on gitter](https://badges.gitter.im/webpack/webpack.svg)](https://gitter.im/webpack/webpack)
[![Greenkeeper badge](https://badges.greenkeeper.io/webpack/webpack-cli.svg)](https://greenkeeper.io/)
[![Install Size](https://packagephobia.now.sh/badge?p=webpack-cli)](https://packagephobia.now.sh/result?p=webpack-cli)

# webpack CLI

* [About](#about)
  - [How to install](#how-to-install)
* [Getting Started](#getting-started)
* [webpack CLI Scaffolds](#webpack-cli-scaffolds)
* Commands
  - [`webpack-cli init`](./packages/init/README.md#webpack-cli-init)
  - [`webpack-cli add`](./packages/add/README.md#webpack-cli-add)
  - [`webpack-cli info`](./packages/info/README.md#webpack-cli-info)
  - [`webpack-cli migrate`](./packages/migrate/README.md#webpack-cli-migrate)
  - [`webpack-cli remove`](./packages/remove/README.md#webpack-cli-remove)
  - [`webpack-cli generate-plugin`](./packages/generate-plugin/README.md#webpack-cli-generate-plugin)
  - [`webpack-cli generate-loader`](./packages/generate-loader/README.md#webpack-cli-generate-loader)
  - [`webpack-cli serve`](./packages/serve/README.md#webpack-cli-serve)
  - [`webpack-cli update`](./packages/update/README.md#webpack-cli-update)
* [webpack.config.js](https://webpack.js.org/concepts/configuration/)
* [Contributing and Internal Documentation](#contributing-and-internal-documentation)

## About

webpack CLI is a CLI tool for providing a flexible set of commands for developers to increase speed when setting up a custom webpack project. As of webpack v4, webpack is not expecting a configuration file but often, developers want to create a more custom webpack configuration based on their use-cases and needs. Exactly all these cases with webpack CLI we are providing a set of tools to improve the setup of custom webpack configuration. 

### How to install

When you have followed the [Getting Started](https://webpack.js.org/guides/getting-started/) guide of webpack then webpack CLI is already installed!

Otherwise `npm install --save-dev webpack-cli` or `yarn add webpack-cli --dev` will install it. 

### Commands

Supporting developers is an important task for webpack CLI. Thus, webpack CLI provides different commands for many common tasks. We organize webpack CLI as a [multi-package repository](https://github.com/lerna/lerna). Every command has a dedicated subfolder in the `packages` Folder.

## Getting started

When you have followed the [Getting Started](https://webpack.js.org/guides/getting-started/) guide of webpack then webpack CLI is already installed! Otherwise, you would need to install webpack CLI and the packages you want to use. If we want to use the `init` functionality to create a new `webpack.config.js` configuration file:

```sh
npm i webpack-cli @webpack-cli/init
npx webpack-cli init
```

You will answer many questions when running the `init` so webpack CLI can provide the best fitting configuration.  

## webpack CLI Scaffolds

With v3 of webpack CLI, we introduced scaffolding as an integral part of the CLI. Our goal is to simplify the creation of webpack configurations for different purposes. Additionally, sharing such solutions with the community is beneficial and with webpack Addon's we want to allow this. We provide `webpack-scaffold` as a utility suite for creating these add-ons. It contains functions that could be of use for creating an addon yourself.

You can read more about [Scaffolding](./SCAFFOLDING.md) or check out the example project [How do I compose a webpack-addon?](https://github.com/ev1stensberg/webpack-addons-demo).

## Contributing and Internal Documentation

The webpack family welcomes any contributor, small or big. We are happy to elaborate, guide you through the source code and find issues you might want to work on! To get started have a look at our [documentation on contributing](CONTRIBUTING.md).

