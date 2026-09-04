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

## @superset-ui/legacy-plugin-chart-country-map

[![Version](https://img.shields.io/npm/v/@superset-ui/legacy-plugin-chart-country-map.svg?style=flat)](https://www.npmjs.com/package/@superset-ui/legacy-plugin-chart-country-map)
[![Libraries.io](https://img.shields.io/librariesio/release/npm/%40superset-ui%2Flegacy-plugin-chart-country-map?style=flat)](https://libraries.io/npm/@superset-ui%2Flegacy-plugin-chart-country-map)

This plugin provides Country Map for Superset.

### Usage

Configure `key`, which can be any `string`, and register the plugin. This `key` will be used to
lookup this chart throughout the app.

```js
import CountryMapChartPlugin from '@superset-ui/legacy-plugin-chart-country-map';

new CountryMapChartPlugin().configure({ key: 'country-map' }).register();
```

Then use it via `SuperChart`. See
[storybook](https://apache-superset.github.io/superset-ui-plugins/?selectedKind=plugin-chart-country-map)
for more details.

```js
<SuperChart
  chartType="country-map"
  width={600}
  height={600}
  formData={...}
  queriesData={[{
    data: {...},
  }]}
/>
```

### Update Map

To update the country maps or add a new country, run scripts in the Jupyter notebook
`scripts/Country Map GeoJSON Generator.ipynb`.

```bash
pip install geopandas shapely matplotlib notebook
jupyter notebook
```
