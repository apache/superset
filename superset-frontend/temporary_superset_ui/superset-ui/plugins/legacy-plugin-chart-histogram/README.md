## @superset-ui/legacy-plugin-chart-histogram

[![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-histogram.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-histogram)
[![David (path)](https://img.shields.io/david/apache-superset/superset-ui-plugins.svg?path=packages%2Fsuperset-ui-legacy-plugin-chart-histogram&style=flat-square)](https://david-dm.org/apache-superset/superset-ui-plugins?path=packages/superset-ui-legacy-plugin-chart-histogram)

This plugin provides Histogram for Superset.

### Usage

Configure `key`, which can be any `string`, and register the plugin. This `key` will be used to
lookup this chart throughout the app.

```js
import HistogramChartPlugin from '@superset-ui/legacy-plugin-chart-histogram';

new HistogramChartPlugin().configure({ key: 'histogram' }).register();
```

Then use it via `SuperChart`. See
[storybook](https://apache-superset.github.io/superset-ui-plugins/?selectedKind=plugin-chart-histogram)
for more details.

```js
<SuperChart
  chartType="histogram"
  width={600}
  height={600}
  formData={...}
  queriesData={[{
    data: {...},
  }]}
/>
```
