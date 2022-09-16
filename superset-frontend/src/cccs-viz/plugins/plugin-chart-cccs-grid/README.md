## @superset-ui/plugin-chart-cccs-grid

[![Version](https://img.shields.io/npm/v/@superset-ui/plugin-chart-cccs-grid.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/plugin-chart-cccs-grid)

This plugin provides CCCS Grid for Superset.

### Usage

Configure `key`, which can be any `string`, and register the plugin. This `key` will be used to lookup this chart throughout the app.

```js
import CccsGridChartPlugin from '@superset-ui/plugin-chart-cccs-grid';

new CccsGridChartPlugin().configure({ key: 'cccs-grid' }).register();
```

Then use it via `SuperChart`. See [storybook](https://apache-superset.github.io/superset-ui/?selectedKind=plugin-chart-cccs-grid) for more details.

```js
<SuperChart
  chartType="cccs-grid"
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
│   ├── CccsGrid.tsx
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
