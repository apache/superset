## @superset-ui/plugin-chart-at-a-glance-user-id



This plugin provides At A Glance User ID for Superset.

### Usage

Configure `key`, which can be any `string`, and register the plugin. This `key` will be used to lookup this chart throughout the app.

```js
import AtAGlanceChartPlugin from '@superset-ui/plugin-chart-at-a-glance-user-id';
new AtAGlanceChartPlugin()
  .configure({ key: 'at_a_glance_user_id' })
  .register();
```

Then use it via `SuperChart`. See [storybook](https://apache-superset.github.io/superset-ui/?selectedKind=plugin-chart-at-a-glance-user-id) for more details.

```js
<SuperChart
  chartType="at_a_glance_user_id"
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
│   ├── AtAGlance.tsx
│   ├── images
│   │   └── thumbnail.png
│   ├── index.ts
│   ├── plugin
│   │   ├── buildQuery.ts
│   │   ├── controlPanel.ts
│   │   ├── index.ts
│   │   └── transformProps.ts
│   └── types.ts
├── test
│   └── index.test.ts
└── types
    └── external.d.ts
```
