## @superset-ui/plugin-chart-choropleth-map

[![Version](https://img.shields.io/npm/v/@superset-ui/plugin-chart-choropleth-map.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/plugin-chart-choropleth-map)
[![David (path)](https://img.shields.io/david/apache-superset/superset-ui.svg?path=packages%2Fsuperset-ui-plugin-chart-choropleth-map&style=flat-square)](https://david-dm.org/apache-superset/superset-ui?path=packages/superset-ui-plugin-chart-choropleth-map)

This plugin provides Choropleth Map for Superset.

### Usage

Configure `key`, which can be any `string`, and register the plugin. This `key` will be used to
lookup this chart throughout the app.

```js
import ChoroplethMapChartPlugin from '@superset-ui/plugin-chart-choropleth-map';

new ChoroplethMapChartPlugin().configure({ key: 'choropleth-map' }).register();
```

Then use it via `SuperChart`. See
[storybook](https://apache-superset.github.io/superset-ui/?selectedKind=plugin-chart-choropleth-map)
for more details.

```js
<SuperChart
  chartType="choropleth-map"
  width={600}
  height={600}
  formData={...}
  queriesData={[{
    data: {...},
  }]}
/>
```
