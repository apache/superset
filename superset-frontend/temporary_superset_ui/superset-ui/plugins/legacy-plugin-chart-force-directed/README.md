## @superset-ui/legacy-plugin-chart-force-directed

[![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-force-directed.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-force-directed)
[![David (path)](https://img.shields.io/david/apache-superset/superset-ui-plugins.svg?path=packages%2Fsuperset-ui-legacy-plugin-chart-force-directed&style=flat-square)](https://david-dm.org/apache-superset/superset-ui-plugins?path=packages/superset-ui-legacy-plugin-chart-force-directed)

This plugin provides Force-directed Graph for Superset.

### Usage

Configure `key`, which can be any `string`, and register the plugin. This `key` will be used to
lookup this chart throughout the app.

```js
import ChordChartPlugin from '@superset-ui/legacy-plugin-chart-force-directed';

new ChordChartPlugin().configure({ key: 'force-directed' }).register();
```

Then use it via `SuperChart`. See
[storybook](https://apache-superset.github.io/superset-ui-plugins/?selectedKind=plugin-chart-force-directed)
for more details.

```js
<SuperChart
  chartType="force-directed"
  width={600}
  height={600}
  formData={...}
  queriesData={[{
    data: {...},
  }]}
/>
```
