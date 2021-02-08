## @superset-ui/legacy-plugin-chart-rose

[![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-rose.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-rose)
[![David (path)](https://img.shields.io/david/apache-superset/superset-ui-plugins.svg?path=packages%2Fsuperset-ui-legacy-plugin-chart-rose&style=flat-square)](https://david-dm.org/apache-superset/superset-ui-plugins?path=packages/superset-ui-legacy-plugin-chart-rose)

This plugin provides Nightingale Rose Diagram for Superset.

### Usage

Configure `key`, which can be any `string`, and register the plugin. This `key` will be used to
lookup this chart throughout the app.

```js
import RoseChartPlugin from '@superset-ui/legacy-plugin-chart-rose';

new RoseChartPlugin().configure({ key: 'rose' }).register();
```

Then use it via `SuperChart`. See
[storybook](https://apache-superset.github.io/superset-ui-plugins/?selectedKind=plugin-chart-rose)
for more details.

```js
<SuperChart
  chartType="rose"
  width={600}
  height={600}
  formData={...}
  queriesData={[{
    data: {...},
  }]}
/>
```
