## @superset-ui/legacy-plugin-chart-iframe

[![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-iframe.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-iframe.svg?style=flat-square)
[![David (path)](https://img.shields.io/david/apache-superset/superset-ui-plugins.svg?path=packages%2Fsuperset-ui-legacy-plugin-chart-iframe&style=flat-square)](https://david-dm.org/apache-superset/superset-ui-plugins?path=packages/superset-ui-legacy-plugin-chart-iframe)

This plugin provides Iframe for Superset.

### Usage

Configure `key`, which can be any `string`, and register the plugin. This `key` will be used to lookup this chart throughout the app.

```js
import IframeChartPlugin from '@superset-ui/legacy-plugin-chart-iframe';

new IframeChartPlugin()
  .configure({ key: 'iframe' })
  .register();
```

Then use it via `SuperChart`. See [storybook](https://apache-superset.github.io/superset-ui-plugins/?selectedKind=plugin-chart-iframe) for more details.

```js
<SuperChart
  chartType="iframe"
  width={600}
  height={600}
  formData={...}
  queryData={{
    data: {...},
  }}
/>
```