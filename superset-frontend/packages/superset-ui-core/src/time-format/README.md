## @superset-ui/core/time-format

Description

#### Example usage

```js
import { getTimeFormatter } from '@superset-ui/core';
const formatter = getTimeFormatter('%Y-%m-d');
console.log(formatter(new Date()));
```

or

```js
import { formatTime } from '@superset-ui/core';
console.log(formatTime('%Y-%m-d', new Date()));
```

It is powered by a registry to support registration of custom formatting, with fallback to
`d3.utcFormat` or `d3.timeFormat` (if the formatId starts with `local!`)

```js
import { getTimeFormatterRegistry, formatTime, TimeFormatter } from '@superset-ui/core';

getTimeFormatterRegistry().registerValue('my_format', new TimeFormatter({
  id: 'my_format',
  formatFunc: v => `my special format of ${utcFormat('%Y')(v)}`
});

console.log(formatTime('my_format', new Date(2018)));
// prints 'my special format of 2018'
```

It also define constants for common d3 time formats. See
[TimeFormats.js](https://github.com/apache-superset/superset-ui/blob/master/packages/superset-ui-time-format/src/TimeFormats.js).

```js
import { TimeFormats } from '@superset-ui/core';

TimeFormats.DATABASE_DATETIME; // '%Y-%m-%d %H:%M:%S'
TimeFormats.US_DATE; // '%m/%d/%Y'
```

#### API

`fn(args)`

- Do something
