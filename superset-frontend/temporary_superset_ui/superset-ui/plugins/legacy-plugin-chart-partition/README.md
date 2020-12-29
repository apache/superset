## @superset-ui/legacy-plugin-chart-partition

[![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-partition.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-partition)
[![David (path)](https://img.shields.io/david/apache-superset/superset-ui-plugins.svg?path=packages%2Fsuperset-ui-legacy-plugin-chart-partition&style=flat-square)](https://david-dm.org/apache-superset/superset-ui-plugins?path=packages/superset-ui-legacy-plugin-chart-partition)

This plugin provides Partition for Superset.

### Usage

Configure `key`, which can be any `string`, and register the plugin. This `key` will be used to
lookup this chart throughout the app.

```js
import PartitionChartPlugin from '@superset-ui/legacy-plugin-chart-partition';

new PartitionChartPlugin().configure({ key: 'partition' }).register();
```

Then use it via `SuperChart`. See
[storybook](https://apache-superset.github.io/superset-ui-plugins/?selectedKind=plugin-chart-partition)
for more details.

```js
<SuperChart
  chartType="partition"
  width={600}
  height={600}
  formData={...}
  queriesData={[{
    data: {...},
  }]}
/>
```
