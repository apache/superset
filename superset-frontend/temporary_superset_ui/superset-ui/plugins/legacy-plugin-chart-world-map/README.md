## @superset-ui/legacy-plugin-chart-world-map

[![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-world-map.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-world-map)
[![David (path)](https://img.shields.io/david/apache-superset/superset-ui-plugins.svg?path=packages%2Fsuperset-ui-legacy-plugin-chart-world-map&style=flat-square)](https://david-dm.org/apache-superset/superset-ui-plugins?path=packages/superset-ui-legacy-plugin-chart-world-map)

This plugin provides World Map for Superset.

### Usage

Configure `key`, which can be any `string`, and register the plugin. This `key` will be used to
lookup this chart throughout the app.

```js
import WorldmapChartPlugin from '@superset-ui/legacy-plugin-chart-world-map';

new WorldmapChartPlugin().configure({ key: 'world-map' }).register();
```

Then use it via `SuperChart`. See
[storybook](https://apache-superset.github.io/superset-ui-plugins/?selectedKind=plugin-chart-world-map)
for more details.

```js
<SuperChart
  chartType="world-map"
  width={600}
  height={600}
  formData={...}
  queriesData={[{
    data: {...},
  }]}
/>
```
