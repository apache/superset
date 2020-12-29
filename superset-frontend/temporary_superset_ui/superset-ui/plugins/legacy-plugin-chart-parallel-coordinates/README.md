## @superset-ui/legacy-plugin-chart-parallel-coordinates

[![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-parallel-coordinates.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-parallel-coordinates)
[![David (path)](https://img.shields.io/david/apache-superset/superset-ui-plugins.svg?path=packages%2Fsuperset-ui-legacy-plugin-chart-parallel-coordinates&style=flat-square)](https://david-dm.org/apache-superset/superset-ui-plugins?path=packages/superset-ui-legacy-plugin-chart-parallel-coordinates)

This plugin provides Parallel Coordinates for Superset.

### Usage

Configure `key`, which can be any `string`, and register the plugin. This `key` will be used to
lookup this chart throughout the app.

```js
import ParallelCoordinatesChartPlugin from '@superset-ui/legacy-plugin-chart-parallel-coordinates';

new ParallelCoordinatesChartPlugin().configure({ key: 'parallel-coordinates' }).register();
```

Then use it via `SuperChart`. See
[storybook](https://apache-superset.github.io/superset-ui-plugins/?selectedKind=plugin-chart-parallel-coordinates)
for more details.

```js
<SuperChart
  chartType="parallel-coordinates"
  width={600}
  height={600}
  formData={...}
  queriesData={[{
    data: {...},
  }]}
/>
```
