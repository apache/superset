# @superset-ui

[![Codecov branch](https://img.shields.io/codecov/c/github/apache-superset/superset-ui/master.svg?style=flat-square)](https://codecov.io/gh/apache-superset/superset-ui/branch/master)
[![Build Status](https://img.shields.io/travis/com/apache-superset/superset-ui/master.svg?style=flat-square)](https://travis-ci.com/apache-superset/superset-ui)
[![David](https://img.shields.io/david/dev/apache-superset/superset-ui.svg?style=flat-square)](https://david-dm.org/apache-superset/superset-ui?type=dev)

Collection of packages that power the
[Apache Superset](https://github.com/apache/incubator-superset) UI, and can be used to craft custom
data applications that leverage a Superset backend :chart_with_upwards_trend:

## Demo

Most recent release: https://apache-superset.github.io/superset-ui/

Current master: https://superset-ui.now.sh/

## Packages

### Core packages

| Package                                                                                                                       | Version                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [@superset-ui/core](https://github.com/apache-superset/superset-ui/tree/master/packages/superset-ui-core)                     | [![Version](https://img.shields.io/npm/v/@superset-ui/core.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/core)                             |
| [@superset-ui/chart-controls](https://github.com/apache-superset/superset-ui/tree/master/packages/superset-ui-chart-controls) | [![Version](https://img.shields.io/npm/v/@superset-ui/core.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/chart-controls)                   |
| [@superset-ui/generator-superset](https://github.com/apache-superset/superset-ui/tree/master/packages/generator-superset)     | [![Version](https://img.shields.io/npm/v/@superset-ui/generator-superset.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/generator-superset) |

### Chart plugin packages

`@superset-ui/legacy-*` packages are extracted from the classic
[Apache Superset](https://github.com/apache/incubator-superset) and converted into plugins. These
packages are extracted with minimal changes (almost as-is). They also depend on legacy API
(`viz.py`) to function.

| Package                                                                                                                                                              | Version                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [@superset-ui/legacy-preset-chart-big-number](https://github.com/apache-superset/superset-ui/tree/master/plugins/legacy-preset-chart-big-number)                     | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-preset-chart-big-number.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-preset-chart-big-number)                     |
| [@superset-ui/legacy-preset-chart-nvd3](https://github.com/apache-superset/superset-ui/tree/master/plugins/legacy-preset-chart-nvd3)                                 | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-preset-chart-nvd3.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-preset-chart-nvd3)                                 |
| [@superset-ui/legacy-plugin-chart-calendar](https://github.com/apache-superset/superset-ui/tree/master/plugins/legacy-plugin-chart-calendar)                         | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-calendar.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-calendar)                         |
| [@superset-ui/legacy-plugin-chart-chord](https://github.com/apache-superset/superset-ui/tree/master/plugins/legacy-plugin-chart-chord)                               | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-chord.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-chord)                               |
| [@superset-ui/legacy-plugin-chart-country-map](https://github.com/apache-superset/superset-ui/tree/master/plugins/legacy-plugin-chart-country-map)                   | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-country-map.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-country-map)                   |
| [@superset-ui/legacy-plugin-chart-event-flow](https://github.com/apache-superset/superset-ui/tree/master/plugins/legacy-plugin-chart-event-flow)                     | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-event-flow.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-event-flow)                     |
| [@superset-ui/legacy-plugin-chart-force-directed](https://github.com/apache-superset/superset-ui/tree/master/plugins/legacy-plugin-chart-force-directed)             | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-force-directed.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-force-directed)             |
| [@superset-ui/legacy-plugin-chart-heatmap](https://github.com/apache-superset/superset-ui/tree/master/plugins/legacy-plugin-chart-heatmap)                           | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-heatmap.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-heatmap)                           |
| [@superset-ui/legacy-plugin-chart-histogram](https://github.com/apache-superset/superset-ui/tree/master/plugins/legacy-plugin-chart-histogram)                       | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-histogram.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-histogram)                       |
| [@superset-ui/legacy-plugin-chart-horizon](https://github.com/apache-superset/superset-ui/tree/master/plugins/legacy-plugin-chart-horizon)                           | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-horizon.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-horizon)                           |
| [@superset-ui/legacy-plugin-chart-iframe](https://github.com/apache-superset/superset-ui/tree/master/plugins/legacy-plugin-chart-iframe)                             | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-iframe.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-iframe)                             |
| [@superset-ui/legacy-plugin-chart-markup](https://github.com/apache-superset/superset-ui/tree/master/plugins/legacy-plugin-chart-markup)                             | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-markup.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-markup)                             |
| [@superset-ui/legacy-plugin-chart-map-box](https://github.com/apache-superset/superset-ui/tree/master/plugins/legacy-plugin-chart-map-box)                           | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-map-box.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-map-box)                           |
| [@superset-ui/legacy-plugin-chart-paired-t-test](https://github.com/apache-superset/superset-ui/tree/master/plugins/legacy-plugin-chart-paired-t-test)               | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-paired-t-test.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-paired-t-test)               |
| [@superset-ui/legacy-plugin-chart-parallel-coordinates](https://github.com/apache-superset/superset-ui/tree/master/plugins/legacy-plugin-chart-parallel-coordinates) | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-parallel-coordinates.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-parallel-coordinates) |
| [@superset-ui/legacy-plugin-chart-partition](https://github.com/apache-superset/superset-ui/tree/master/plugins/legacy-plugin-chart-partition)                       | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-partition.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-partition)                       |
| [@superset-ui/legacy-plugin-chart-pivot-table](https://github.com/apache-superset/superset-ui/tree/master/plugins/legacy-plugin-chart-pivot-table)                   | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-pivot-table.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-pivot-table)                   |
| [@superset-ui/legacy-plugin-chart-rose](https://github.com/apache-superset/superset-ui/tree/master/plugins/legacy-plugin-chart-rose)                                 | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-rose.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-rose)                                 |
| [@superset-ui/legacy-plugin-chart-sankey](https://github.com/apache-superset/superset-ui/tree/master/plugins/legacy-plugin-chart-sankey)                             | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-sankey.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-sankey)                             |
| [@superset-ui/legacy-plugin-chart-sankey-loop](https://github.com/apache-superset/superset-ui/tree/master/plugins/legacy-plugin-chart-sankey-loop)                   | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-sankey-loop.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-sankey-loop)                   |
| [@superset-ui/legacy-plugin-chart-sunburst](https://github.com/apache-superset/superset-ui/tree/master/plugins/legacy-plugin-chart-sunburst)                         | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-sunburst.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-sunburst)                         |
| [@superset-ui/legacy-plugin-chart-treemap](https://github.com/apache-superset/superset-ui/tree/master/plugins/legacy-plugin-chart-treemap)                           | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-treemap.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-treemap)                           |
| [@superset-ui/legacy-plugin-chart-world-map](https://github.com/apache-superset/superset-ui/tree/master/plugins/legacy-plugin-chart-world-map)                       | [![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-world-map.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-world-map)                       |

`@superset-ui/plugin-*` packages are newer and higher quality in general. A key difference that they
do not depend on `viz.py` (which contain visualization-specific python code) and interface with
`/api/v1/query/`, a new generic endpoint instead meant to serve all visualizations, instead. Also
should be written in Typescript.

| Package                                                                                                                            | Version                                                                                                                                                                   | Note |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| [@superset-ui/plugin-chart-word-cloud](https://github.com/apache-superset/superset-ui/tree/master/plugins/plugin-chart-word-cloud) | [![Version](https://img.shields.io/npm/v/@superset-ui/plugin-chart-word-cloud.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/plugin-chart-word-cloud) |      |
| [@superset-ui/plugin-chart-table](https://github.com/apache-superset/superset-ui/tree/master/plugins/plugin-chart-table)           | [![Version](https://img.shields.io/npm/v/@superset-ui/plugin-chart-table.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/plugin-chart-table)           |      |
| [@superset-ui/preset-chart-xy](https://github.com/apache-superset/superset-ui/tree/master/plugins/preset-chart-xy)                 | [![Version](https://img.shields.io/npm/v/@superset-ui/preset-chart-xy.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/preset-chart-xy)                 |      |
| [@superset-ui/plugin-chart-echarts](https://github.com/apache-superset/superset-ui/tree/master/plugins/plugin-chart-echarts)       | [![Version](https://img.shields.io/npm/v/@superset-ui/plugin-chart-echarts.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/plugin-chart-echarts)       |      |
| [@superset-ui/plugin-filter-antd](https://github.com/apache-superset/superset-ui/tree/master/plugins/plugin-filter-antd)           | [![Version](https://img.shields.io/npm/v/@superset-ui/plugin-chart-echarts.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/plugin-filter-antd)         |      |

## Contribution and development guide

Please read the [contributing guidelines](CONTRIBUTING.md) which include development environment
setup and other things you should know about coding in this repo.

### License

Apache-2.0
