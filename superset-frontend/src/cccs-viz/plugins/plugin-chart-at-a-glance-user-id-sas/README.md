## @superset-ui/plugin-chart-at-a-glance-sas

This plugin provides At A Glance User ID for Superset.

### Usage

Configure `key`, which can be any `string`, and register the plugin. This `key`
will be used to lookup this chart throughout the app.

```js
import AtAGlanceChartUserIDSasPlugin from '@superset-ui/plugin-chart-at-a-glance-userid-sas';
new AtAGlanceChartPlugin()
  .configure({ key: 'at_a_glance_user_id_sas' })
  .register();
```

Then use it via `SuperChart`. See [storybook](https://apache-superset.github.io/superset-ui/?selectedKind=plugin-chart-at-a-glance) for more details.

```js
<SuperChart
  chartType="at_a_glance_user_id_sas"
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
├── README.md
├── src
│   ├── AtAGlanceUserIdSas.tsx
│   ├── images
│   │   ├── thumbnail.png
│   │   └── thumbnail.png:Zone.Identifier
│   ├── index.ts
│   ├── plugin
│   │   ├── buildQuery.ts
│   │   ├── controlPanel.ts
│   │   ├── index.ts
│   │   └── transformProps.ts
│   └── styles.js
├── test
│   ├── index.test.ts
│   └── plugin
│       ├── buildQuery.test.ts
│       └── transformProps.test.ts
└── types
    └── external.d.ts
```
