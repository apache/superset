## @superset-ui/legacy-plugin-chart-calendar

[![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-calendar.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-calendar)
[![David (path)](https://img.shields.io/david/apache-superset/superset-ui-plugins.svg?path=packages%2Fsuperset-ui-legacy-plugin-chart-calendar&style=flat-square)](https://david-dm.org/apache-superset/superset-ui-plugins?path=packages/superset-ui-legacy-plugin-chart-calendar)

This plugin provides Calendar Heatmap for Superset.

### Usage

Configure `key`, which can be any `string`, and register the plugin. This `key` will be used to
lookup this chart throughout the app.

```js
import CalendarChartPlugin from '@superset-ui/legacy-plugin-chart-calendar';

new CalendarChartPlugin().configure({ key: 'calendar' }).register();
```

Then use it via `SuperChart`. See
[storybook](https://apache-superset.github.io/superset-ui-plugins/?selectedKind=plugin-chart-calendar)
for more details.

```js
<SuperChart
  chartType="calendar"
  width={600}
  height={600}
  formData={...}
  queriesData={[{
    data: {...},
  }]}
/>
```
