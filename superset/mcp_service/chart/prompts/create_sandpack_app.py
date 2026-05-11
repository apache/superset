# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

"""
Guided prompt for authoring chart_type="sandpack" apps.
"""

from superset_core.mcp.decorators import prompt


@prompt("create_sandpack_app")
async def create_sandpack_app_prompt(
    template: str = "react",
) -> str:
    """Guidance for writing a Sandpack chart app.

    Args:
        template: Sandpack template — react, react-ts, vanilla, vanilla-ts.
    """
    valid_templates = ("react", "react-ts", "vanilla", "vanilla-ts")
    template = template if template in valid_templates else "react"

    entry_file = {
        "react": "App.js (default export of a React component)",
        "react-ts": "App.tsx (default export of a React component)",
        "vanilla": "index.js (top-level script — write to document.body)",
        "vanilla-ts": "index.ts (top-level script — write to document.body)",
    }[template]

    return f"""**Authoring a Sandpack Chart**

Sandpack charts let you ship a small, self-contained app rendered against the
query result. The chart frame mounts the Sandpack bundler at view time.

## The contract — read this first

1. **Data is exposed as `./data.json`** inside the sandbox. The shape mirrors
   what the query returns (one row per array element, snake_case-style keys).
2. **`app_code` is the entry file**. For `{template}` that file is **{entry_file}**.
3. **Pick `query_mode` based on what your app needs**:
   - `query_mode="raw"` (default for sandpack) → row-level data via `columns`.
   - `query_mode="aggregate"` → grouped data via `metrics`/`groupby`.
4. **Add npm packages with `dependencies`** (a `{{name: semver}}` object) only
   when you actually `import` them. React/ReactDOM ship with the react templates.

## Workflow

### Step 1 — Pick a dataset
Call `list_datasets` and `get_dataset_info(dataset_id)`. Note the column names
exactly as Superset returns them; `./data.json` will use the same keys.

### Step 2 — Decide raw vs. aggregate
- "Show me a list / a table / row-level details" → `query_mode="raw"`,
  set `columns: [...]`.
- "Show me a chart of grouped numbers" → `query_mode="aggregate"`,
  set `metrics: [{{"name": "...", "aggregate": "SUM"}}]` and optionally `groupby`.
  In aggregate mode, metric keys in `./data.json` look like `"SUM(revenue)"`.

### Step 3 — Write `app_code`
Always start with:
```js
import data from './data.json';
```
Then default-export a React component (for react/react-ts) or write to
`document.body` (vanilla). Keep it one file when you can.

### Step 4 — Submit via `generate_chart` or `generate_explore_link`
```json
{{
  "dataset_id": <id>,
  "config": {{
    "chart_type": "sandpack",
    "template": "{template}",
    "query_mode": "raw",
    "columns": [{{"name": "<column>"}}],
    "app_code": "...",
    "dependencies": {{"recharts": "^2.12.0"}}
  }}
}}
```

## Worked examples

### Minimal list (raw mode, react)
```js
import data from './data.json';

export default function App() {{
  return (
    <ul>
      {{data.map((row, i) => (
        <li key={{i}}>{{JSON.stringify(row)}}</li>
      ))}}
    </ul>
  );
}}
```

### Grouped bar chart (aggregate mode, react + recharts)
- `metrics: [{{"name": "revenue", "aggregate": "SUM"}}]`, `groupby: [{{"name": "region"}}]`
- `dependencies: {{"recharts": "^2.12.0"}}`
```js
import data from './data.json';
import {{ BarChart, Bar, XAxis, YAxis, Tooltip }} from 'recharts';

export default function App() {{
  return (
    <BarChart width={{500}} height={{300}} data={{data}}>
      <XAxis dataKey="region" />
      <YAxis />
      <Tooltip />
      <Bar dataKey="SUM(revenue)" />
    </BarChart>
  );
}}
```

## Common pitfalls

- **Wrong key in aggregate mode**: in aggregate mode keys are `"SUM(col)"`,
  `"COUNT(col)"`, etc. — not the bare column name. Inspect a row first.
- **Forgot `import data from './data.json'`**: the bundle still loads, but the
  app has no data. Always import the JSON.
- **Used a package without declaring it**: every imported package needs an entry
  in `dependencies` (except react/react-dom on react templates).
- **Multi-file apps**: only `app_code` is editable from MCP today. If you need
  multiple files, inline them into one entry file or open the chart in Explore
  to edit further.
- **Heavy bundles**: Sandpack rebundles on every prop change. Avoid pulling in
  charting kitchen-sink libraries when a small one will do.

## Verification

After calling `generate_chart` or `generate_explore_link`, open the URL it
returns in a browser. If the preview shows a Sandpack error overlay, fix the
`app_code` (syntax, missing dependency, wrong data key) and re-call the tool —
the chart's `form_data` is rewritten on each call.
"""
