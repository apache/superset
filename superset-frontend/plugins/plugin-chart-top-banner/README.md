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


# Superset Top Banner Plugin

A configurable Apache Superset visualization with:

- Title and subtitle
- Emoji or short text icon
- Live local clock with IANA time zone support
- Left/right clock placement
- Date pattern, font-size, spacing, color, and border controls
- Camel-case custom control names for Superset Explore form-data compatibility

## Build inside the Superset frontend workspace

Place the directory at:

```text
superset-frontend/plugins/plugin-chart-top-banner
```

Then run:

```bash
cd superset-frontend/plugins/plugin-chart-top-banner
npm install
npm run build
```

If dependencies are supplied by the parent Superset workspace, use the workspace's normal installation command instead of installing a second dependency tree.

## Register in Superset

In the visualization preset where custom plugins are registered, import the plugin:

```ts
import TopBannerChartPlugin from '@superset-ui/plugin-chart-top-banner';
```

Then add:

```ts
new TopBannerChartPlugin().configure({ key: 'top-banner' }),
```

Keep the exact key `top-banner` consistent with the registered plugin. Rebuild the Superset frontend or container image, recreate the relevant container, and hard-refresh the browser.

## Important
Custom form-data keys use camelCase consistently, for example `clockFontSize`, `showSeconds`, and `clockPosition`. Do not rename only one occurrence; the same key must be used in `controlPanel.ts`, `types.ts`, and `transformProps.ts`.
