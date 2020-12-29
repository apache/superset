## @superset-ui/legacy-plugin-chart-chord

[![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-chord.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-chord)
[![David (path)](https://img.shields.io/david/apache-superset/superset-ui-plugins.svg?path=packages%2Fsuperset-ui-legacy-plugin-chart-chord&style=flat-square)](https://david-dm.org/apache-superset/superset-ui-plugins?path=packages/superset-ui-legacy-plugin-chart-chord)

This plugin provides Chord Diagram for Superset.

### Usage

Configure `key`, which can be any `string`, and register the plugin. This `key` will be used to
lookup this chart throughout the app.

```js
import ChordChartPlugin from '@superset-ui/legacy-plugin-chart-chord';

new ChordChartPlugin().configure({ key: 'chord' }).register();
```

Then use it via `SuperChart`. See
[storybook](https://apache-superset.github.io/superset-ui-plugins/?selectedKind=plugin-chart-chord)
for more details.

```js
<SuperChart
  chartType="chord"
  width={600}
  height={600}
  formData={...}
  queriesData={[{
    data: {...},
  }]}
/>
```
