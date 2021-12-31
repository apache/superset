## @superset-ui/plugin-chart-handlebars

[![Version](https://img.shields.io/npm/v/@superset-ui/plugin-chart-handlebars.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/plugin-chart-handlebars)

This plugin provides Write a handlebars template to render the data for Superset.

### Usage

Configure `key`, which can be any `string`, and register the plugin. This `key` will be used to
lookup this chart throughout the app.

```js
import HandlebarsChartPlugin from '@superset-ui/plugin-chart-handlebars';

new HandlebarsChartPlugin().configure({ key: 'handlebars' }).register();
```

Then use it via `SuperChart`. See
[storybook](https://apache-superset.github.io/superset-ui/?selectedKind=plugin-chart-handlebars) for
more details.

```js
<SuperChart
  chartType="handlebars"
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
│   ├── Handlebars.tsx
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
