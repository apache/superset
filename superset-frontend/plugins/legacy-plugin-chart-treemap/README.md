## @superset-ui/legacy-plugin-chart-treemap

[![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-treemap.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-treemap)
[![David (path)](https://img.shields.io/david/apache-superset/superset-ui-plugins.svg?path=packages%2Fsuperset-ui-legacy-plugin-chart-treemap&style=flat-square)](https://david-dm.org/apache-superset/superset-ui-plugins?path=packages/superset-ui-legacy-plugin-chart-treemap)

This plugin provides Treemap for Superset.

### Usage

Configure `key`, which can be any `string`, and register the plugin. This `key` will be used to
lookup this chart throughout the app.

```js
import TreemapChartPlugin from '@superset-ui/legacy-plugin-chart-treemap';

new TreemapChartPlugin().configure({ key: 'treemap' }).register();
```

Then use it via `SuperChart`. See
[storybook](https://apache-superset.github.io/superset-ui-plugins/?selectedKind=plugin-chart-treemap)
for more details.

```js
<SuperChart
  chartType="treemap"
  width={600}
  height={600}
  formData={...}
  queriesData={[{
    data: {...},
  }]}
/>
```
