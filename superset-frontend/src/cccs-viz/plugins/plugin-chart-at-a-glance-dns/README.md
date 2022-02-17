## @superset-ui/plugin-chart-at-a-glance-dns

This plugin provides At A Glance listing of DNS entries for an ip_string.

### Usage

Configure `key`, which can be any `string`, and register the plugin. This `key` will be used to lookup this chart throughout the app.

```js
import AtAGlanceChartPlugin from '@superset-ui/plugin-chart-at-a-glance-dns';
new AtAGlanceChartPlugin()
  .configure({ key: 'at_a_glance_dns' })
  .register();
```

Then use it via `SuperChart`. See [storybook](https://apache-superset.github.io/superset-ui/?selectedKind=plugin-chart-at-a-glance) for more details.

```js
<SuperChart
  chartType="at_a_glance_dns"
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
│   ├── AtAGlanceDns.tsx
│   ├── images
│   │   ├── thumbnail.png
│   │   └── thumbnail.png:Zone.Identifier
│   ├── index.ts
│   └── plugin
│       ├── buildQuery.ts
│       ├── controlPanel.ts
│       ├── index.ts
│       └── transformProps.ts
├── test
│   ├── index.test.ts
│   └── plugin
│       ├── buildQuery.test.ts
│       └── transformProps.test.ts
└── types
    └── external.d.ts
```
