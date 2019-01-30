## @superset-ui/legacy-plugin-chart-<%= packageName %>

[![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-<%= packageName %>.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-<%= packageName %>.svg?style=flat-square)
[![David (path)](https://img.shields.io/david/apache-superset/superset-ui.svg?path=packages%2Fsuperset-ui-legacy-plugin-chart-<%= packageName %>&style=flat-square)](https://david-dm.org/apache-superset/superset-ui?path=packages/superset-ui-legacy-plugin-chart-<%= packageName %>)

This plugin provides <%= description %> for Superset.

### Usage

Configure `key`, which can be any `string`, and register the plugin. This `key` will be used to lookup this chart throughout the app.

```js
import <%= packageLabel %>ChartPlugin from '@superset-ui/legacy-plugin-chart-<%= packageName %>';

new <%= packageLabel %>ChartPlugin()
  .configure({ key: '<%= packageName %>' })
  .register();
```

Then use it via `SuperChart`. See [storybook](https://apache-superset.github.io/superset-ui-legacy/?selectedKind=plugin-chart-<%= packageName %>) for more details.

```js
<SuperChart
  chartType="<%= packageName %>"
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