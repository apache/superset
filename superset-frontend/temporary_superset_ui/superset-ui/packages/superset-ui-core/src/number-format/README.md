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

## @superset-ui/core/number-format

Description

#### Example usage

Functions `getNumberFormatter` and `formatNumber` should be used instead of calling `d3.format`
directly.

```js
import { getNumberFormatter } from '@superset-ui/core';
const formatter = getNumberFormatter('.2f');
console.log(formatter(1000));
```

or

```js
import { formatNumber } from '@superset-ui/core';
console.log(formatNumber('.2f', 1000));
```

It is powered by a registry to support registration of custom formatting, with fallback to
`d3.format` and handle error for invalid format string.

```js
import { getNumberFormatterRegistry, formatNumber, NumberFormatter } from '@superset-ui/core';

getNumberFormatterRegistry().registerValue('my_format', new NumberFormatter({
  id: 'my_format',
  formatFunc: v => `my special format of ${v}`
});

console.log(formatNumber('my_format', 1000));
// prints 'my special format of 1000'
```

It also define constants for common d3 formats. See the full list of formats in
[NumberFormats.js](https://github.com/apache-superset/superset-ui/blob/master/packages/superset-ui-number-format/src/NumberFormats.js).

```js
import { NumberFormats } from '@superset-ui-number-format';

NumberFormats.PERCENT; // ,.2%
NumberFormats.PERCENT_3_POINT; // ,.3%
```

There is also a formatter based on [pretty-ms](https://www.npmjs.com/package/pretty-ms) that can be
used to format time durations:

```js
import { createDurationFormatter, formatNumber, getNumberFormatterRegistry } from from '@superset-ui-number-format';

getNumberFormatterRegistry().registerValue('my_duration_format', createDurationFormatter({ colonNotation: true });
console.log(formatNumber('my_duration_format', 95500))
// prints '1:35.5'
```

#### API

`fn(args)`

- Do something
