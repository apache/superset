## @superset-ui/legacy-plugin-chart-pivot-table

[![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-pivot-table.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-pivot-table)
[![David (path)](https://img.shields.io/david/apache-superset/superset-ui-plugins.svg?path=packages%2Fsuperset-ui-legacy-plugin-chart-pivot-table&style=flat-square)](https://david-dm.org/apache-superset/superset-ui-plugins?path=packages/superset-ui-legacy-plugin-chart-pivot-table)

This plugin provides Pivot Table for Superset.

### Usage

Configure `key`, which can be any `string`, and register the plugin. This `key` will be used to
lookup this chart throughout the app.

```js
import PivottableChartPlugin from '@superset-ui/legacy-plugin-chart-pivot-table';

new PivottableChartPlugin().configure({ key: 'pivot-table' }).register();
```

Then use it via `SuperChart`. See
[storybook](https://apache-superset.github.io/superset-ui-plugins/?selectedKind=plugin-chart-pivot-table)
for more details.

```js
<SuperChart
  chartType="pivot-table"
  width={600}
  height={600}
  formData={...}
  queriesData={[{
    data: {...},
  }]}
/>
```
