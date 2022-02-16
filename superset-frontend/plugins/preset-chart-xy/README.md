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

## @superset-ui/preset-chart-xy

[![Version](https://img.shields.io/npm/v/@superset-ui/preset-chart-xy.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/preset-chart-xy)
[![David (path)](https://img.shields.io/david/apache-superset/superset-ui-plugins.svg?path=packages%2Fsuperset-ui-preset-chart-xy&style=flat-square)](https://david-dm.org/apache-superset/superset-ui-plugins?path=packages/superset-ui-preset-chart-xy)

This plugin provides basic charts on cartesian coordinates (Line, Box Plot) for Superset.

> DISCLAIMER: It is still under heavy development and the APIs are subject to changes.

### Usage

Configure `key`, which can be any `string`, and register the plugin. This `key` will be used to
lookup this chart throughout the app.

```js
import { BoxPlotChartPlugin } from '@superset-ui/preset-chart-xy';

new BoxPlotChartPlugin().configure({ key: 'box-plot' }).register();
```

Then use it via `SuperChart`. See
[storybook](https://apache-superset.github.io/superset-ui-plugins/?selectedKind=plugin-chart-box-plot)
for more details.

```js
<SuperChart
  chartType="box-plot"
  width={600}
  height={600}
  formData={...}
  queriesData={[{
    data: {...},
  }]}
/>
```
