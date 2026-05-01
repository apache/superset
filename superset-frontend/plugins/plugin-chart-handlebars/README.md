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

## @superset-ui/plugin-chart-handlebars

[![Version](https://img.shields.io/npm/v/@superset-ui/plugin-chart-handlebars.svg?style=flat)](https://www.npmjs.com/package/@superset-ui/plugin-chart-handlebars)
[![Libraries.io](https://img.shields.io/librariesio/release/npm/%40superset-ui%2Fplugin-chart-handlebars?style=flat)](https://libraries.io/npm/@superset-ui%2Fplugin-chart-handlebars)

This plugin renders the data using a handlebars template.

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

### Available Handlebars Helpers in Superset

Below, you will find a list of all currently registered helpers in the Handlebars plugin for Superset. These helpers are registered and managed in the file [`HandlebarsViewer.tsx`](./path/to/HandlebarsViewer.tsx).

#### List of Registered Helpers:

1. **`dateFormat`**: Formats a date using a specified format.
   - **Usage**: `{{dateFormat my_date format="MMMM YYYY"}}`
   - **Default format**: `YYYY-MM-DD`.

2. **`stringify`**: Converts an object into a JSON string or returns a string representation of non-object values.
   - **Usage**: `{{stringify myObj}}`.

3. **`formatNumber`**: Formats a number using locale-specific formatting.
   - **Usage**: `{{formatNumber number locale="en-US"}}`.
   - **Default locale**: `en-US`.

4. **`parseJson`**: Parses a JSON string into a JavaScript object.
   - **Usage**: `{{parseJson jsonString}}`.
   
5. **eq**: Returns true if values are equal.
   - **Usage**: {{eq a b}}

6. **neq**: Returns true if values are not equal.
   - **Usage**: {{neq a b}}

7. **gt**: Returns true if a > b.
   - **Usage**: {{gt a b}}

8. **lt**: Returns true if a < b.
   - **Usage**: {{lt a b}}
