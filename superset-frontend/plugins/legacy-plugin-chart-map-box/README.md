## @superset-ui/legacy-plugin-chart-map-box

[![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-map-box.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-map-box)
[![David (path)](https://img.shields.io/david/apache-superset/superset-ui-plugins.svg?path=packages%2Fsuperset-ui-legacy-plugin-chart-map-box&style=flat-square)](https://david-dm.org/apache-superset/superset-ui-plugins?path=packages/superset-ui-legacy-plugin-chart-map-box)

This plugin provides MapBox for Superset.

### Usage

Configure `key`, which can be any `string`, and register the plugin. This `key` will be used to
lookup this chart throughout the app.

```js
import MapBoxChartPlugin from '@superset-ui/legacy-plugin-chart-map-box';

new MapBoxChartPlugin().configure({ key: 'map-box' }).register();
```

Then use it via `SuperChart`. See
[storybook](https://apache-superset.github.io/superset-ui-plugins/?selectedKind=plugin-chart-map-box)
for more details.

```js
<SuperChart
  chartType="map-box"
  width={600}
  height={600}
  formData={...}
  queriesData={[{
    data: {...},
  }]}
/>
```
