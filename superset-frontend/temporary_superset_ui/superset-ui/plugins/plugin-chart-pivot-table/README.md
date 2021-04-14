## @superset-ui/plugin-chart-pivot-table

[![Version](https://img.shields.io/npm/v/@superset-ui/plugin-chart-pivot-table.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/plugin-chart-pivot-table)

This plugin provides Pivot Table for Superset.

### Usage

Configure `key`, which can be any `string`, and register the plugin. This `key` will be used to
lookup this chart throughout the app.

```js
import PivotTableChartPlugin from '@superset-ui/plugin-chart-pivot-table';

new PivotTableChartPlugin().configure({ key: 'pivot-table-v2' }).register();
```

Then use it via `SuperChart`. See
[storybook](https://apache-superset.github.io/superset-ui/?selectedKind=plugin-chart-pivot-table)
for more details.

```js
<SuperChart
  chartType="pivot-table-v2"
  width={600}
  height={600}
  formData={...}
  queriesData={[{
    data: {...},
  }]}
/>
```

### File structure generated

```
├── package.json
├── README.md
├── tsconfig.json
├── src
│   ├── PivotTableChart.tsx
│   ├── images
│   │   └── thumbnail.png
│   ├── index.ts
│   ├── plugin
│   │   ├── buildQuery.ts
│   │   ├── controlPanel.ts
│   │   ├── index.ts
│   │   └── transformProps.ts
│   └── types.ts
├── test
│   └── index.test.ts
└── types
    └── external.d.ts
```
