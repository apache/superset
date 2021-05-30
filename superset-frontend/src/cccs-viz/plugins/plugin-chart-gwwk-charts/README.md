## @superset-ui/plugin-chart-gwwk-charts

[![Version](https://img.shields.io/npm/v/@superset-ui/plugin-chart-gwwk-charts.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/plugin-chart-gwwk-charts)

This plugin provides Iframe Demo for Superset.

### Usage

Configure `key`, which can be any `string`, and register the plugin. This `key` will be used to lookup this chart throughout the app.

```js
import IframeDemoChartPlugin from '@superset-ui/plugin-chart-gwwk-charts';

new IframeDemoChartPlugin()
  .configure({ key: 'gwwk-charts' })
  .register();
```

Then use it via `SuperChart`. See [storybook](https://apache-superset.github.io/superset-ui/?selectedKind=plugin-chart-gwwk-charts) for more details.

```js
<SuperChart
  chartType="gwwk-charts"
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
│   ├── IframeDemo.tsx
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
