# Vega: A Visualization Grammar <a href="https://vega.github.io/vega/"><img align="right" src="https://github.com/vega/logos/blob/master/assets/VG_Color@512.png?raw=true" height="38"></img></a>

<a href="https://vega.github.io/vega/examples">
<img src="https://vega.github.io/vega/assets/banner.png" alt="Vega Examples" width="900"></img>
</a>

**Vega** is a *visualization grammar*, a declarative format for creating, saving, and sharing interactive visualization designs. With Vega you can describe data visualizations in a JSON format, and generate interactive views using either HTML5 Canvas or SVG.

For documentation, tutorials, and examples, see the [Vega website](https://vega.github.io/vega). For a description of changes between Vega 2 and later versions, please refer to the [Vega Porting Guide](https://vega.github.io/vega/docs/porting-guide/).

## Install

Use npm or yarn to install Vega for use in third-party libraries or applications.

Using npm:

```sh
npm install vega
```

or using yarn:

```sh
yarn add vega
```

If you would like to install the Vega command line utilities (`vg2pdf`, `vg2png`, `vg2svg`), see the [`vega-cli` package](https://github.com/vega/vega/tree/master/packages/vega-cli).

## Contributions, Development, and Support

Interested in contributing to Vega? Please see our [contribution and development guidelines](CONTRIBUTING.md), subject to our [code of conduct](CODE_OF_CONDUCT.md).

Looking for support, or interested in sharing examples and tips? Post to the [Vega discussion forum](https://groups.google.com/forum/#!forum/vega-js) or join the [Vega slack organization](https://bit.ly/join-vega-slack-2020)!

Read about future plans in [our roadmap](https://docs.google.com/document/d/1fscSxSJtfkd1m027r1ONCc7O8RdZp1oGABwca2pgV_E/edit#).

## Package Development

This package builds the bundled Vega library files and the JSON schema. It also includes a high-level test suite. If performing local development:

- Run `yarn build` to build both browser and node.js bundles.
- Run `yarn test` to run the test suite.
