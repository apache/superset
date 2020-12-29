## @superset-ui/plugin-filter-antd

[![Version](https://img.shields.io/npm/v/@superset-ui/plugin-filter-antd.svg?style=flat-square)](https://www.npmjs.com/package/@superset-ui/plugin-filter-antd)

This plugin provides native filter plugins based on AntD.

### Usage

Configure `key`, which can be any `string`, and register the plugin. This `key` will be used to
lookup this chart throughout the app.

Below is an example of how to use the Select filter plugin.

```js
import { AntdFilterSelectPlugin } from '@superset-ui/plugin-filter-antd';

new AntdFilterSelectPlugin().configure({ key: 'plugin-filter-select' }).register();
```

Then use it via `SuperChart`.

```js
<SuperChart
  chartType="plugin-filter-select"
  width={600}
  height={600}
  formData={...}
  queriesData={[{
    data: {...},
    // this hook gets called
    hooks: { setExtraFormData: extraFormData => console.log(extraFormData) },
  }]}
/>
```
