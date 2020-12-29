## @superset-ui/legacy-plugin-chart-sankey

[![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-sankey.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-sankey)
[![David (path)](https://img.shields.io/david/apache-superset/superset-ui-plugins.svg?path=packages%2Fsuperset-ui-legacy-plugin-chart-sankey&style=flat-square)](https://david-dm.org/apache-superset/superset-ui-plugins?path=packages/superset-ui-legacy-plugin-chart-sankey)

This plugin provides Sankey Diagram for Superset.

### Usage

Configure `key`, which can be any `string`, and register the plugin. This `key` will be used to
lookup this chart throughout the app.

```js
import SankeyChartPlugin from '@superset-ui/legacy-plugin-chart-sankey';

new SankeyChartPlugin().configure({ key: 'sankey' }).register();
```

Then use it via `SuperChart`. See
[storybook](https://apache-superset.github.io/superset-ui-plugins/?selectedKind=plugin-chart-sankey)
for more details.

```js
<SuperChart
  chartType="sankey"
  width={600}
  height={600}
  formData={...}
  queriesData={[{
    data: {...},
  }]}
/>
```
