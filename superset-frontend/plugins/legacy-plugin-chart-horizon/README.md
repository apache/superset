## @superset-ui/legacy-plugin-chart-horizon

[![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-horizon.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-horizon)
[![David (path)](https://img.shields.io/david/apache-superset/superset-ui-plugins.svg?path=packages%2Fsuperset-ui-legacy-plugin-chart-horizon&style=flat-square)](https://david-dm.org/apache-superset/superset-ui-plugins?path=packages/superset-ui-legacy-plugin-chart-horizon)

This plugin provides Horizon for Superset.

### Usage

Configure `key`, which can be any `string`, and register the plugin. This `key` will be used to
lookup this chart throughout the app.

```js
import HorizonChartPlugin from '@superset-ui/legacy-plugin-chart-horizon';

new HorizonChartPlugin().configure({ key: 'horizon' }).register();
```

Then use it via `SuperChart`. See
[storybook](https://apache-superset.github.io/superset-ui-plugins/?selectedKind=plugin-chart-horizon)
for more details.

```js
<SuperChart
  chartType="horizon"
  width={600}
  height={600}
  formData={...}
  queriesData={[{
    data: {...},
  }]}
/>
```
