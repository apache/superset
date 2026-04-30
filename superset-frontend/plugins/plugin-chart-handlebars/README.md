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
│   ├── Handlebars.tsx
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

### Available Handlebars Helpers in Superset

Below, you will find a list of all currently registered helpers in the Handlebars plugin for Superset. These helpers are registered and managed in the file [`HandlebarsViewer.tsx`](./src/components/Handlebars/HandlebarsViewer.tsx).

The plugin registers 4 custom helpers directly and also imports all helpers from [`just-handlebars-helpers`](https://github.com/leapfrogtechnology/just-handlebars-helpers) via `Helpers.registerHelpers(Handlebars)`.

#### Custom Helpers (registered in HandlebarsViewer.tsx)

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

#### Helpers from just-handlebars-helpers (39 helpers)

##### Comparison & Conditionals

5. **`eq`** — Equal to: `{{eq value1 value2}}`
6. **`neq`** — Not equal to: `{{neq value1 value2}}`
7. **`lt`** — Less than: `{{lt value1 value2}}`
8. **`lte`** — Less than or equal: `{{lte value1 value2}}`
9. **`gt`** — Greater than: `{{gt value1 value2}}`
10. **`gte`** — Greater than or equal: `{{gte value1 value2}}`
11. **`ifx`** — Conditional: `{{ifx condition value1 value2}}`
12. **`not`** — Negate boolean: `{{not expression}}`
13. **`empty`** — Check if value is empty: `{{empty array}}`
14. **`count`** — Count array elements: `{{count myArray}}`
15. **`and`** — Logical AND: `{{and cond1 cond2}}`
16. **`or`** — Logical OR: `{{or cond1 cond2}}`
17. **`coalesce`** — Return first non-null value
18. **`includes`** — Check if collection contains value

##### Math

19. **`sum`** — Add two numbers
20. **`difference`** — Subtract second from first
21. **`multiplication`** — Multiply two numbers
22. **`division`** — Divide first by second
23. **`remainder`** — Modulo operation
24. **`ceil`** — Round up
25. **`floor`** — Round down
26. **`abs`** — Absolute value

##### Strings

27. **`excerpt`** — Truncate text to N characters
28. **`sanitize`** — Escape HTML entities
29. **`newLineToBr`** — Convert newlines to `<br>` tags
30. **`capitalizeEach`** — Title Case each word
31. **`capitalizeFirst`** — Capitalize first character
32. **`sprintf`** — C-style printf formatting
33. **`lowercase`** — Convert to lowercase
34. **`uppercase`** — Convert to uppercase
35. **`first`** — Get first item from collection
36. **`last`** — Get last item from collection
37. **`concat`** — Concatenate strings

##### HTML Helpers

38. **`showIf`** — Add `style="display:block"` when true
39. **`hideIf`** — Add `style="display:none"` when true
40. **`selectedIf`** — Add `selected` attribute when true
41. **`checkedIf`** — Add `checked` attribute when true
42. **`options`** — Generate `<option>` elements from array

##### Date & Time

43. **`formatDate`** — Format date with moment.js: `{{formatDate date "YYYY-MM-DD"}}`

##### Formatters

44. **`formatCurrency`** — Format number as currency: `{{formatCurrency amount currency="USD"}}`

> **Note**: Some helpers from just-handlebars-helpers may have naming conflicts (e.g., `eqw`, `neqw`). Use the base names (`eq`, `neq`) when possible. For a complete list, see [just-handlebars-helpers source](https://github.com/leapfrogtechnology/just-handlebars-helpers).
