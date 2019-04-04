## @superset-ui/legacy-plugin-chart-country-map

[![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-country-map.svg?style=flat-square)](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-country-map.svg?style=flat-square)
[![David (path)](https://img.shields.io/david/apache-superset/superset-ui-plugins.svg?path=packages%2Fsuperset-ui-legacy-plugin-chart-country-map&style=flat-square)](https://david-dm.org/apache-superset/superset-ui-plugins?path=packages/superset-ui-legacy-plugin-chart-country-map)

This plugin provides Country Map for Superset.

### Usage

Configure `key`, which can be any `string`, and register the plugin. This `key` will be used to lookup this chart throughout the app.

```js
import CountryMapChartPlugin from '@superset-ui/legacy-plugin-chart-country-map';

new CountryMapChartPlugin()
  .configure({ key: 'country-map' })
  .register();
```

Then use it via `SuperChart`. See [storybook](https://apache-superset.github.io/superset-ui-plugins/?selectedKind=plugin-chart-country-map) for more details.

```js
<SuperChart
  chartType="country-map"
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