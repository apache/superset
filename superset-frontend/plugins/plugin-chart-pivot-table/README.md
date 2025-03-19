<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

## @superset-ui/plugin-chart-pivot-table

[![Version](https://img.shields.io/npm/v/@superset-ui/plugin-chart-pivot-table.svg?style=flat)](https://www.npmjs.com/package/@superset-ui/plugin-chart-pivot-table)
[![Libraries.io](https://img.shields.io/librariesio/release/npm/%40superset-ui%2Fplugin-chart-pivot-table?style=flat)](https://libraries.io/npm/@superset-ui%2Fplugin-chart-pivot-table)

This plugin provides Pivot Table for Superset.

If you change the logic of this plugin, please update
[`pivot_table`](https://github.com/apache/superset/blob/master/superset/charts/post_processing.py).

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
