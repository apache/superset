## @superset-ui/plugin-chart-time-table

[![Version](https://img.shields.io/npm/v/@superset-ui/plugin-time-table.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/plugin-chart-time-table)
[![David (path)](https://img.shields.io/david/apache-superset/superset-ui-plugins.svg?path=packages%2Fsuperset-ui-plugin-chart-time-table&style=flat-square)](https://david-dm.org/apache-superset/superset-ui-plugins?path=packages/superset-ui-plugin-chart-time-table)

This plugin provides Time Table for Superset.

### Usage

Configure `key`, which can be any `string`, and register the plugin. This `key` will be used to
lookup this chart throughout the app.

```js
import TimeTableChartPlugin from '@superset-ui/legacy-plugin-chart-time-table';

new TimeTableChartPlugin().configure({ key: 'time-table' }).register();
```

Then use it via `SuperChart`. See
[storybook](https://apache-superset.github.io/superset-ui-plugins/?selectedKind=plugin-chart-time-table)
for more details.

```js
<SuperChart
  chartType="time-table"
  width={600}
  height={600}
  formData={...}
  queriesData={[{
    data: {...},
  }]}
/>
```
