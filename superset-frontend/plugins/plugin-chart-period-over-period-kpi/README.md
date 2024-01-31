/\*\*

- Licensed to the Apache Software Foundation (ASF) under one
- or more contributor license agreements. See the NOTICE file
- distributed with this work for additional information
- regarding copyright ownership. The ASF licenses this file
- to you under the Apache License, Version 2.0 (the
- "License"); you may not use this file except in compliance
- with the License. You may obtain a copy of the License at
-
- http://www.apache.org/licenses/LICENSE-2.0
-
- Unless required by applicable law or agreed to in writing,
- software distributed under the License is distributed on an
- "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
- KIND, either express or implied. See the License for the
- specific language governing permissions and limitations
- under the License.
  \*/

# custom-viz

This plugin provides a BigNumber visualization with period over period time comparisons

### Usage

To build the plugin, run the following commands:

```
npm ci
npm run build
```

Alternatively, to run the plugin in development mode (=rebuilding whenever changes are made), start the dev server with the following command:

```
npm run dev
```

To add the package to Superset, go to the `superset-frontend` subdirectory in your Superset source folder (assuming both the `custom-viz` plugin and `superset` repos are in the same root directory) and run

```
npm i -S ../../plugin-chart-period-over-period-kpi
```

If your Superset plugin exists in the `superset-frontend` directory and you wish to resolve TypeScript errors about `@superset-ui/core` not being resolved correctly, add the following to your `tsconfig.json` file:

```
"references": [
  {
    "path": "../../packages/superset-ui-chart-controls"
  },
  {
    "path": "../../packages/superset-ui-core"
  }
]
```

You may also wish to add the following to the `include` array in `tsconfig.json` to make Superset types available to your plugin:

```
"../../types/**/*"
```

Finally, if you wish to ensure your plugin `tsconfig.json` is aligned with the root Superset project, you may add the following to your `tsconfig.json` file:

```
"extends": "../../tsconfig.json",
```

After this edit the `superset-frontend/src/visualizations/presets/MainPreset.js` and make the following changes:

```js
import { PopKPIPlugin } from '@superset-ui/plugin-chart-period-over-period-kpi';
```

to import the plugin and later add the following to the array that's passed to the `plugins` property:

```js
new PopKPIPlugin().configure({ key: 'pop_kpi' }),
```

After that the plugin should show up when you run Superset, e.g. the development server:

```
npm run dev-server
```
