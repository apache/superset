# @superset-ui/plugins 🔌💡

[![Codecov branch](https://img.shields.io/codecov/c/github/apache-superset/superset-ui-plugins/master.svg?style=flat-square)](https://codecov.io/gh/apache-superset/superset-ui-plugins/branch/master)
[![Build Status](https://img.shields.io/travis/com/apache-superset/superset-ui-plugins/master.svg?style=flat-square
)](https://travis-ci.com/apache-superset/superset-ui-plugins)
[![David](https://img.shields.io/david/dev/apache-superset/superset-ui-plugins.svg?style=flat-square)](https://david-dm.org/apache-superset/superset-ui-plugins?type=dev)
[![Netlify Status](https://api.netlify.com/api/v1/badges/d2c78390-752e-4fc2-abf0-7e6df362b9ff/deploy-status)](https://app.netlify.com/sites/superset-ui-plugins/deploys)

`@superset-ui/legacy-*` packages are extracted from the classic [Apache Superset](https://github.com/apache/incubator-superset) and converted into plugins.
These packages are extracted with minimal changes (almost as-is). They also depend on legacy API (`viz.py`) to function.

`@superset-ui/plugin-*` packages are newer and has higher quality in general.
A key difference that they do not depend on `viz.py`
(which contain visualization-specific python code) and interface with
`/api/v1/query/` instead: a new generic endpoint instead meant to
serve all visualizations. Also should be written in Typescript.

We are not accepting pull requests for new community-contributed plugins to be merged into this repository at the moment.
We will keep it lean for now to improve the standard and reduce operational load on maintenance.
Bug fixes are welcome.

To setup your own plugin repository,
we current have a template for new repository that you can copy from.
Go to ["superset-ui-plugins-template"](https://github.com/apache-superset/superset-ui-plugins-template)
and look for the green "Use this template" button.

This way anybody can create and publish a Superset plugin.
In the future, we may create a generator, which may make it a bit more convenient.

## Demo (Storybook)

Most recent release: https://apache-superset.github.io/superset-ui-plugins/

Current master: https://superset-ui-plugins.netlify.com

## Packages

| Package | Version | Note |
|--|--|--|
| [@superset-ui/plugin-chart-word-cloud](https://github.com/apache-superset/superset-ui/tree/master/packages/superset-ui-plugin-chart-word-cloud) | [![Version](https://img.shields.io/npm/v/@superset-ui/plugin-chart-word-cloud.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/plugin-chart-word-cloud.svg?style=flat-square) | |
| [@superset-ui/preset-chart-xy](https://github.com/apache-superset/superset-ui/tree/master/packages/superset-ui-preset-chart-xy) | [![Version](https://img.shields.io/npm/v/@superset-ui/preset-chart-xy.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/preset-chart-xy.svg?style=flat-square) | experimental |

| Package | Version |
|--|--|
| [@superset-ui/legacy-preset-chart-big-number](https://github.com/apache-superset/superset-ui-plugins/tree/master/packages/superset-ui-legacy-preset-chart-big-number) | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-preset-chart-big-number.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/legacy-preset-chart-big-number.svg?style=flat-square) |
| [@superset-ui/legacy-preset-chart-nvd3](https://github.com/apache-superset/superset-ui-plugins/tree/master/packages/superset-ui-legacy-preset-chart-nvd3) | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-preset-chart-nvd3.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/legacy-preset-chart-nvd3.svg?style=flat-square) |
| [@superset-ui/legacy-plugin-chart-calendar](https://github.com/apache-superset/superset-ui-plugins/tree/master/packages/superset-ui-legacy-plugin-chart-calendar) | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-calendar.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-calendar.svg?style=flat-square) |
| [@superset-ui/legacy-plugin-chart-chord](https://github.com/apache-superset/superset-ui-plugins/tree/master/packages/superset-ui-legacy-plugin-chart-chord) | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-chord.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-chord.svg?style=flat-square) |
| [@superset-ui/legacy-plugin-chart-country-map](https://github.com/apache-superset/superset-ui-plugins/tree/master/packages/superset-ui-legacy-plugin-chart-country-map) | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-country-map.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-country-map.svg?style=flat-square) |
| [@superset-ui/legacy-plugin-chart-event-flow](https://github.com/apache-superset/superset-ui-plugins/tree/master/packages/superset-ui-legacy-plugin-chart-event-flow) | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-event-flow.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-event-flow.svg?style=flat-square) |
| [@superset-ui/legacy-plugin-chart-force-directed](https://github.com/apache-superset/superset-ui-plugins/tree/master/packages/superset-ui-legacy-plugin-chart-force-directed) | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-force-directed.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-force-directed.svg?style=flat-square) |
| [@superset-ui/legacy-plugin-chart-heatmap](https://github.com/apache-superset/superset-ui-plugins/tree/master/packages/superset-ui-legacy-plugin-chart-heatmap) | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-heatmap.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-heatmap.svg?style=flat-square) |
| [@superset-ui/legacy-plugin-chart-histogram](https://github.com/apache-superset/superset-ui-plugins/tree/master/packages/superset-ui-legacy-plugin-chart-histogram) | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-histogram.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-histogram.svg?style=flat-square) |
| [@superset-ui/legacy-plugin-chart-horizon](https://github.com/apache-superset/superset-ui-plugins/tree/master/packages/superset-ui-legacy-plugin-chart-horizon) | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-horizon.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-horizon.svg?style=flat-square) |
| [@superset-ui/legacy-plugin-chart-iframe](https://github.com/apache-superset/superset-ui-plugins/tree/master/packages/superset-ui-legacy-plugin-chart-iframe) | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-iframe.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-iframe.svg?style=flat-square) |
| [@superset-ui/legacy-plugin-chart-markup](https://github.com/apache-superset/superset-ui-plugins/tree/master/packages/superset-ui-legacy-plugin-chart-markup) | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-markup.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-markup.svg?style=flat-square) |
| [@superset-ui/legacy-plugin-chart-map-box](https://github.com/apache-superset/superset-ui-plugins/tree/master/packages/superset-ui-legacy-plugin-chart-map-box) | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-map-box.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-map-box.svg?style=flat-square) |
| [@superset-ui/legacy-plugin-chart-paired-t-test](https://github.com/apache-superset/superset-ui-plugins/tree/master/packages/superset-ui-legacy-plugin-chart-paired-t-test) | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-paired-t-test.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-paired-t-test.svg?style=flat-square) |
| [@superset-ui/legacy-plugin-chart-parallel-coordinates](https://github.com/apache-superset/superset-ui-plugins/tree/master/packages/superset-ui-legacy-plugin-chart-parallel-coordinates) | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-parallel-coordinates.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-parallel-coordinates.svg?style=flat-square) |
| [@superset-ui/legacy-plugin-chart-partition](https://github.com/apache-superset/superset-ui-plugins/tree/master/packages/superset-ui-legacy-plugin-chart-partition) | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-partition.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-partition.svg?style=flat-square) |
| [@superset-ui/legacy-plugin-chart-pivot-table](https://github.com/apache-superset/superset-ui-plugins/tree/master/packages/superset-ui-legacy-plugin-chart-pivot-table) | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-pivot-table.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-pivot-table.svg?style=flat-square) |
| [@superset-ui/legacy-plugin-chart-rose](https://github.com/apache-superset/superset-ui-plugins/tree/master/packages/superset-ui-legacy-plugin-chart-rose) | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-rose.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-rose.svg?style=flat-square) |
| [@superset-ui/legacy-plugin-chart-sankey](https://github.com/apache-superset/superset-ui-plugins/tree/master/packages/superset-ui-legacy-plugin-chart-sankey) | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-sankey.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-sankey.svg?style=flat-square) |
| [@superset-ui/legacy-plugin-chart-sankey-loop](https://github.com/apache-superset/superset-ui-plugins/tree/master/packages/superset-ui-legacy-plugin-chart-sankey-loop) | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-sankey-loop.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-sankey-loop.svg?style=flat-square) |
| [@superset-ui/legacy-plugin-chart-sunburst](https://github.com/apache-superset/superset-ui-plugins/tree/master/packages/superset-ui-legacy-plugin-chart-sunburst) | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-sunburst.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-sunburst.svg?style=flat-square) |
| [@superset-ui/legacy-plugin-chart-table](https://github.com/apache-superset/superset-ui-plugins/tree/master/packages/superset-ui-legacy-plugin-chart-table) | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-table.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-table.svg?style=flat-square) |
| [@superset-ui/legacy-plugin-chart-treemap](https://github.com/apache-superset/superset-ui-plugins/tree/master/packages/superset-ui-legacy-plugin-chart-treemap) | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-treemap.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-treemap.svg?style=flat-square) |
| [@superset-ui/legacy-plugin-chart-word-cloud](https://github.com/apache-superset/superset-ui-plugins/tree/master/packages/superset-ui-legacy-plugin-chart-word-cloud) | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-word-cloud.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-word-cloud.svg?style=flat-square) |
| [@superset-ui/legacy-plugin-chart-world-map](https://github.com/apache-superset/superset-ui-plugins/tree/master/packages/superset-ui-legacy-plugin-chart-world-map) | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-world-map.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-world-map.svg?style=flat-square) |

## Contribution and development guide

Please read the [contributing guidelines](https://github.com/apache-superset/superset-ui/blob/master/CONTRIBUTING.md) which include development environment setup
and other things you should know about coding in this repo.

### License

Apache-2.0
