## @superset-ui/time-format

[![Version](https://img.shields.io/npm/v/@superset-ui/time-format.svg?style=flat)](https://img.shields.io/npm/v/@superset-ui/time-format.svg?style=flat)
[![David (path)](https://img.shields.io/david/apache-superset/superset-ui.svg?path=packages%2Fsuperset-ui-time-format&style=flat-square)](https://david-dm.org/apache-superset/superset-ui?path=packages/superset-ui-time-format)

Description

#### Example usage

Add `@superset-ui/time-format`, a module for formatting time. Functions `getTimeFormatter` and `formatTime` should be used instead of calling `d3.utcFormat` or `d3.timeFormat`  directly.

```js
import { getTimeFormatter } from '@superset-ui/time-format';
const formatter = getTimeFormatter('%Y-%m-d');
console.log(formatter(new Date()));
```

or

```js
import { formatTime } from '@superset-ui/time-format';
console.log(formatTime('%Y-%m-d', new Date()));
```

It is powered by a registry to support registration of custom formatting, with fallback to `d3.utcFormat` or `d3.timeFormat` (if the formatId starts with `local!`)

```js
import { getTimeFormatterRegistry, formatTime, TimeFormatter } from '@superset-ui/time-format';

getTimeFormatterRegistry().registerValue('my_format', new TimeFormatter({
  id: 'my_format',
  formatFunc: v => `my special format of ${utcFormat('%Y')(v)}`
});

console.log(formatTime('my_format', new Date(2018)));
// prints 'my special format of 2018'
```

It also define constants for common d3 time formats. See [TimeFormats.js](https://github.com/apache-superset/superset-ui/blob/master/packages/superset-ui-time-format/src/TimeFormats.js).

```js
import { TimeFormats } from '@superset-ui/time-format';

TimeFormats.DATABASE_DATETIME // '%Y-%m-%d %H:%M:%S'
TimeFormats.US_DATE // '%m/%d/%Y'
```

#### API

`fn(args)`

- Do something

### Development

`@data-ui/build-config` is used to manage the build configuration for this package including babel
builds, jest testing, eslint, and prettier.
