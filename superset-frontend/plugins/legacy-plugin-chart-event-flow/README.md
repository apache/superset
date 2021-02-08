## @superset-ui/legacy-plugin-chart-event-flow

[![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-event-flow.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-event-flow)
[![David (path)](https://img.shields.io/david/apache-superset/superset-ui-plugins.svg?path=packages%2Fsuperset-ui-legacy-plugin-chart-event-flow&style=flat-square)](https://david-dm.org/apache-superset/superset-ui-plugins?path=packages/superset-ui-legacy-plugin-chart-event-flow)

This plugin provides Event Flow for Superset.

### Usage

Configure `key`, which can be any `string`, and register the plugin. This `key` will be used to
lookup this chart throughout the app.

```js
import EventFlowChartPlugin from '@superset-ui/legacy-plugin-chart-event-flow';

new EventFlowChartPlugin().configure({ key: 'event-flow' }).register();
```

Then use it via `SuperChart`. See
[storybook](https://apache-superset.github.io/superset-ui-plugins/?selectedKind=plugin-chart-event-flow)
for more details.

```js
<SuperChart
  chartType="event-flow"
  width={600}
  height={600}
  formData={...}
  queriesData={[{
    data: {...},
  }]}
/>
```
