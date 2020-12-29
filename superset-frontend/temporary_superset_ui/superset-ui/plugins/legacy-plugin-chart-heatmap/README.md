## @superset-ui/legacy-plugin-chart-heatmap

[![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-heatmap.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-heatmap)
[![David (path)](https://img.shields.io/david/apache-superset/superset-ui-plugins.svg?path=packages%2Fsuperset-ui-legacy-plugin-chart-heatmap&style=flat-square)](https://david-dm.org/apache-superset/superset-ui-plugins?path=packages/superset-ui-legacy-plugin-chart-heatmap)

This plugin provides Heatmap for Superset.

### Usage

Configure `key`, which can be any `string`, and register the plugin. This `key` will be used to
lookup this chart throughout the app.

```js
import HeatmapChartPlugin from '@superset-ui/legacy-plugin-chart-heatmap';

new HeatmapChartPlugin().configure({ key: 'heatmap' }).register();
```

Then use it via `SuperChart`. See
[storybook](https://apache-superset.github.io/superset-ui-plugins/?selectedKind=plugin-chart-heatmap)
for more details.

```js
<SuperChart
  chartType="heatmap"
  width={600}
  height={600}
  formData={...}
  queriesData={[{
    data: {...},
  }]}
/>
```
