## @superset-ui/plugin-chart-gwwk-charts

[![Version](https://img.shields.io/npm/v/@superset-ui/plugin-chart-gwwk-charts.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/plugin-chart-gwwk-charts)

This plugin provides GWWK Discovery for Superset.

### Usage

Configure `key`, which can be any `string`, and register the plugin. This `key` will be used to lookup this chart throughout the app.

```js
import GWWKChartPlugin from '@superset-ui/plugin-chart-gwwk-charts';

new GWWKChartPlugin()
  .configure({ key: 'gwwk-charts' })
  .register();
```

Then use it via `SuperChart`. See [storybook](https://apache-superset.github.io/superset-ui/?selectedKind=plugin-chart-gwwk-charts) for more details.

```js
<SuperChart
  chartType="gwwk-charts"
  width={600}
  height={600}
  formData={...}
  queriesData={[{
    data: {...},
  }]}
/>
```

