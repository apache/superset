## @superset-ui/plugin-chart-iframe-demo

[![Version](https://img.shields.io/npm/v/@superset-ui/plugin-chart-iframe-demo.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/plugin-chart-iframe-demo)

This plugin provides Iframe Demo for Superset.

### Usage

Configure `key`, which can be any `string`, and register the plugin. This `key` will be used to lookup this chart throughout the app.

```js
import IframeDemoChartPlugin from '@superset-ui/plugin-chart-iframe-demo';

new IframeDemoChartPlugin()
  .configure({ key: 'iframe-demo' })
  .register();
```

Then use it via `SuperChart`. See [storybook](https://apache-superset.github.io/superset-ui/?selectedKind=plugin-chart-iframe-demo) for more details.

```js
<SuperChart
  chartType="iframe-demo"
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