## @superset-ui/legacy-plugin-chart-box-plot

[![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-box-plot.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-box-plot.svg?style=flat-square)
[![David (path)](https://img.shields.io/david/apache-superset/superset-ui.svg?path=packages%2Fsuperset-ui-legacy-plugin-chart-box-plot&style=flat-square)](https://david-dm.org/apache-superset/superset-ui?path=packages/superset-ui-legacy-plugin-chart-box-plot)

This plugin provides Box Plot for Superset.

### Usage

Configure `key`, which can be any `string`, and register the plugin. This `key` will be used to lookup this chart throughout the app.

```js
import BoxPlotChartPlugin from '@superset-ui/legacy-plugin-chart-box-plot';

new BoxPlotChartPlugin()
  .configure({ key: 'box-plot' })
  .register();
```

Then use it via `SuperChart`. See [storybook](https://apache-superset.github.io/superset-ui-legacy/?selectedKind=plugin-chart-box-plot) for more details.

```js
<SuperChart
  chartType="box-plot"
  chartProps={{
    width: 600,
    height: 600,
    formData: {...},
    payload: {
      data: {...},
    },
  }}
/>
```