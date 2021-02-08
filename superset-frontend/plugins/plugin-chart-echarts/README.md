## @superset-ui/plugin-chart-echarts

[![Version](https://img.shields.io/npm/v/@superset-ui/plugin-chart-echarts.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/plugin-chart-echarts)
[![David (path)](https://img.shields.io/david/apache-superset/superset-ui.svg?path=packages%2Fsuperset-ui-plugin-chart-echarts&style=flat-square)](https://david-dm.org/apache-superset/superset-ui?path=packages/superset-ui-plugin-chart-echarts)

This plugin provides Echarts viz plugins for Superset:

- Timeseries Chart (combined line, area bar with support for predictive analytics)
- Pie Chart

### Usage

Configure `key`, which can be any `string`, and register the plugin. This `key` will be used to
lookup this chart throughout the app.

```js
import {
  EchartsTimeseriesChartPlugin,
  EchartsPieChartPlugin,
} from '@superset-ui/plugin-chart-echarts';

new EchartsTimeseriesChartPlugin().configure({ key: 'echarts-ts' }).register();
new EchartsPieChartPlugin().configure({ key: 'echarts-pie' }).register();
```

Then use it via `SuperChart`. See
[storybook](https://apache-superset.github.io/superset-ui/?selectedKind=chart-plugins-plugin-chart-echarts)
for more details.

```js
<SuperChart
  chartType="echarts-ts"
  width={600}
  height={600}
  formData={...}
  queriesData={[{
    data: {...},
  }]}
/>
```
