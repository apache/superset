## @superset-ui/legacy-plugin-chart-paired-t-test

[![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-paired-t-test.svg?style=flat-square)](hhttps://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-paired-t-test)
[![David (path)](https://img.shields.io/david/apache-superset/superset-ui-plugins.svg?path=packages%2Fsuperset-ui-legacy-plugin-chart-paired-t-test&style=flat-square)](https://david-dm.org/apache-superset/superset-ui-plugins?path=packages/superset-ui-legacy-plugin-chart-paired-t-test)

This plugin provides Paired T Test for Superset.

### Usage

Configure `key`, which can be any `string`, and register the plugin. This `key` will be used to
lookup this chart throughout the app.

```js
import PairedTTestChartPlugin from '@superset-ui/legacy-plugin-chart-paired-t-test';

new PairedTTestChartPlugin().configure({ key: 'paired-t-test' }).register();
```

Then use it via `SuperChart`. See
[storybook](https://apache-superset.github.io/superset-ui-plugins/?selectedKind=plugin-chart-paired-t-test)
for more details.

```js
<SuperChart
  chartType="paired-t-test"
  width={600}
  height={600}
  formData={...}
  queriesData={[{
    data: {...},
  }]}
/>
```
