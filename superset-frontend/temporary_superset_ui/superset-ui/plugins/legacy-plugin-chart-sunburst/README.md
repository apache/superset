## @superset-ui/legacy-plugin-chart-sunburst

[![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-sunburst.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-sunburst)
[![David (path)](https://img.shields.io/david/apache-superset/superset-ui-plugins.svg?path=packages%2Fsuperset-ui-legacy-plugin-chart-sunburst&style=flat-square)](https://david-dm.org/apache-superset/superset-ui-plugins?path=packages/superset-ui-legacy-plugin-chart-sunburst)

This plugin provides Sunburst for Superset.

### Usage

Configure `key`, which can be any `string`, and register the plugin. This `key` will be used to
lookup this chart throughout the app.

```js
import SunburstChartPlugin from '@superset-ui/legacy-plugin-chart-sunburst';

new SunburstChartPlugin().configure({ key: 'sunburst' }).register();
```

Then use it via `SuperChart`. See
[storybook](https://apache-superset.github.io/superset-ui-plugins/?selectedKind=plugin-chart-sunburst)
for more details.

```js
<SuperChart
  chartType="sunburst"
  width={600}
  height={600}
  formData={...}
  queriesData={[{
    data: {...},
  }]}
/>
```
