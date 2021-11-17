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

## @superset-ui/legacy-preset-chart-big-number

[![Version](https://img.shields.io/npm/v/@superset-ui/legacy-preset-chart-big-number.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/legacy-preset-chart-big-number)
[![David (path)](https://img.shields.io/david/apache-superset/superset-ui-plugins.svg?path=packages%2Fsuperset-ui-legacy-preset-chart-big-number&style=flat-square)](https://david-dm.org/apache-superset/superset-ui-plugins?path=plugins/superset-ui-legacy-preset-chart-big-number)

This plugin provides Big Number for Superset.

### Usage

Import the preset and register. This will register the `BigNumber` and `BigNumberTotal` charts with
key `big-number` and `big-number-total`, respectively.

```js
import { BigNumberChartPreset } from '@superset-ui/legacy-preset-chart-big-number';

new BigNumberChartPreset().register();
```

or register charts one by one. Configure `key`, which can be any `string`, and register the plugin.
This `key` will be used to lookup this chart throughout the app.

```js
import {
  BigNumberChartPlugin,
  BigNumberTotalChartPlugin,
} from '@superset-ui/legacy-preset-chart-big-number';

new BigNumberChartPlugin().configure({ key: 'big-number' }).register();
new BigNumberTotalChartPlugin()
  .configure({ key: 'big-number-total' })
  .register();
```

Then use it via `SuperChart`. See
[storybook](https://apache-superset.github.io/superset-ui-plugins/?selectedKind=plugin-chart-big-number)
for more details.

```js
<SuperChart
  chartType="big-number"
  width={600}
  height={600}
  formData={...}
  queriesData={[{
    data: {...},
  }]}
/>
```
