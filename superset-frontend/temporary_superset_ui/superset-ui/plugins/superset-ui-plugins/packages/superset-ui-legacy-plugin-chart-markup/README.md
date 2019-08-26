## @superset-ui/legacy-plugin-chart-markup

[![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-markup.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-markup.svg?style=flat-square)
[![David (path)](https://img.shields.io/david/apache-superset/superset-ui-plugins.svg?path=packages%2Fsuperset-ui-legacy-plugin-chart-markup&style=flat-square)](https://david-dm.org/apache-superset/superset-ui-plugins?path=packages/superset-ui-legacy-plugin-chart-markup)

This plugin provides Markup for Superset.

### Usage

Configure `key`, which can be any `string`, and register the plugin. This `key` will be used to lookup this chart throughout the app.

```js
import MarkupChartPlugin from '@superset-ui/legacy-plugin-chart-markup';

new MarkupChartPlugin()
  .configure({ key: 'markup' })
  .register();
```

Then use it via `SuperChart`. See [storybook](https://apache-superset.github.io/superset-ui-plugins/?selectedKind=plugin-chart-markup) for more details.

```js
<SuperChart
  chartType="markup"
  width={600}
  height={600}
  formData={...}
  queryData={{
    data: {...},
  }}
/>
```