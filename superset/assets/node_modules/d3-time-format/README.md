# d3-time-format

This module provides a JavaScript implementation of the venerable [strptime](http://pubs.opengroup.org/onlinepubs/009695399/functions/strptime.html) and [strftime](http://pubs.opengroup.org/onlinepubs/007908799/xsh/strftime.html) functions from the C standard library, and can be used to parse or format [dates](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date) in a variety of locale-specific representations. To format a date, create a [formatter](#locale_format) from a specifier (a string with the desired format *directives*, indicated by `%`); then pass a date to the formatter, which returns a string. For example, to convert the current date to a human-readable string:

```js
var formatTime = d3.timeFormat("%B %d, %Y");
formatTime(new Date); // "June 30, 2015"
```

Likewise, to convert a string back to a date, create a [parser](#locale_parse):

```js
var parseTime = d3.timeParse("%B %d, %Y");
parseTime("June 30, 2015"); // Tue Jun 30 2015 00:00:00 GMT-0700 (PDT)
```

You can implement more elaborate conditional time formats, too. For example, here’s a [multi-scale time format](http://bl.ocks.org/mbostock/4149176) using [time intervals](https://github.com/d3/d3-time):

```js
var formatMillisecond = d3.timeFormat(".%L"),
    formatSecond = d3.timeFormat(":%S"),
    formatMinute = d3.timeFormat("%I:%M"),
    formatHour = d3.timeFormat("%I %p"),
    formatDay = d3.timeFormat("%a %d"),
    formatWeek = d3.timeFormat("%b %d"),
    formatMonth = d3.timeFormat("%B"),
    formatYear = d3.timeFormat("%Y");

function multiFormat(date) {
  return (d3.timeSecond(date) < date ? formatMillisecond
      : d3.timeMinute(date) < date ? formatSecond
      : d3.timeHour(date) < date ? formatMinute
      : d3.timeDay(date) < date ? formatHour
      : d3.timeMonth(date) < date ? (d3.timeWeek(date) < date ? formatDay : formatWeek)
      : d3.timeYear(date) < date ? formatMonth
      : formatYear)(date);
}
```

This module is used by D3 [time scales](https://github.com/d3/d3-scale/blob/master/README.md#time-scales) to generate human-readable ticks.

## Installing

If you use NPM, `npm install d3-time-format`. Otherwise, download the [latest release](https://github.com/d3/d3-time-format/releases/latest). You can also load directly from [d3js.org](https://d3js.org), either as a [standalone library](https://d3js.org/d3-time-format.v2.min.js) or as part of [D3 4.0](https://github.com/d3/d3). AMD, CommonJS, and vanilla environments are supported. In vanilla, a `d3` global is exported:

```html
<script src="https://d3js.org/d3-time.v1.min.js"></script>
<script src="https://d3js.org/d3-time-format.v2.min.js"></script>
<script>

var format = d3.timeFormat("%x");

</script>
```

Locale files are hosted on [unpkg](https://unpkg.com/) and can be loaded using [d3.json](https://github.com/d3/d3-request/blob/master/README.md#json). For example, to set Russian as the default locale:

```js
d3.json("https://unpkg.com/d3-time-format@2/locale/ru-RU.json", function(error, locale) {
  if (error) throw error;

  d3.timeFormatDefaultLocale(locale);

  var format = d3.timeFormat("%c");

  console.log(format(new Date)); // понедельник,  5 декабря 2016 г. 10:31:59
});
```

[Try d3-time-format in your browser.](https://tonicdev.com/npm/d3-time-format)

## API Reference

<a name="timeFormat" href="#timeFormat">#</a> d3.<b>timeFormat</b>(<i>specifier</i>) [<>](https://github.com/d3/d3-time-format/blob/master/src/defaultLocale.js#L4 "Source")

An alias for [*locale*.format](#locale_format) on the [default locale](#timeFormatDefaultLocale).

<a name="timeParse" href="#timeParse">#</a> d3.<b>timeParse</b>(<i>specifier</i>) [<>](https://github.com/d3/d3-time-format/blob/master/src/defaultLocale.js#L5 "Source")

An alias for [*locale*.parse](#locale_parse) on the [default locale](#timeFormatDefaultLocale).

<a name="utcFormat" href="#utcFormat">#</a> d3.<b>utcFormat</b>(<i>specifier</i>) [<>](https://github.com/d3/d3-time-format/blob/master/src/defaultLocale.js#L6 "Source")

An alias for [*locale*.utcFormat](#locale_utcFormat) on the [default locale](#timeFormatDefaultLocale).

<a name="utcParse" href="#utcParse">#</a> d3.<b>utcParse</b>(<i>specifier</i>) [<>](https://github.com/d3/d3-time-format/blob/master/src/defaultLocale.js#L7 "Source")

An alias for [*locale*.utcParse](#locale_utcParse) on the [default locale](#timeFormatDefaultLocale).

<a name="isoFormat" href="#isoFormat">#</a> d3.<b>isoFormat</b> [<>](https://github.com/d3/d3-time-format/blob/master/src/isoFormat.js "Source")

The full [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) UTC time formatter. Where available, this method will use [Date.toISOString](https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/toISOString) to format.

<a name="isoParse" href="#isoParse">#</a> d3.<b>isoParse</b> [<>](https://github.com/d3/d3-time-format/blob/master/src/isoParse.js "Source")

The full [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) UTC time parser. Where available, this method will use the [Date constructor](https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date) to parse strings. If you depend on strict validation of the input format according to ISO 8601, you should construct a [UTC parser function](#utcParse):

```js
var strictIsoParse = d3.utcParse("%Y-%m-%dT%H:%M:%S.%LZ");
```

<a name="locale_format" href="#locale_format">#</a> <i>locale</i>.<b>format</b>(<i>specifier</i>) [<>](https://github.com/d3/d3-time-format/blob/master/src/locale.js#L293 "Source")

Returns a new formatter for the given string *specifier*. The specifier string may contain the following directives:

* `%a` - abbreviated weekday name.*
* `%A` - full weekday name.*
* `%b` - abbreviated month name.*
* `%B` - full month name.*
* `%c` - the locale’s date and time, such as `%x, %X`.*
* `%d` - zero-padded day of the month as a decimal number [01,31].
* `%e` - space-padded day of the month as a decimal number [ 1,31]; equivalent to `%_d`.
* `%f` - microseconds as a decimal number [000000, 999999].
* `%H` - hour (24-hour clock) as a decimal number [00,23].
* `%I` - hour (12-hour clock) as a decimal number [01,12].
* `%j` - day of the year as a decimal number [001,366].
* `%m` - month as a decimal number [01,12].
* `%M` - minute as a decimal number [00,59].
* `%L` - milliseconds as a decimal number [000, 999].
* `%p` - either AM or PM.*
* `%Q` - milliseconds since UNIX epoch.
* `%s` - seconds since UNIX epoch.
* `%S` - second as a decimal number [00,61].
* `%u` - Monday-based (ISO 8601) weekday as a decimal number [1,7].
* `%U` - Sunday-based week of the year as a decimal number [00,53].
* `%V` - ISO 8601 week of the year as a decimal number [01, 53].
* `%w` - Sunday-based weekday as a decimal number [0,6].
* `%W` - Monday-based week of the year as a decimal number [00,53].
* `%x` - the locale’s date, such as `%-m/%-d/%Y`.*
* `%X` - the locale’s time, such as `%-I:%M:%S %p`.*
* `%y` - year without century as a decimal number [00,99].
* `%Y` - year with century as a decimal number.
* `%Z` - time zone offset, such as `-0700`, `-07:00`, `-07`, or `Z`.
* `%%` - a literal percent sign (`%`).

Directives marked with an asterisk (\*) may be affected by the [locale definition](#localeFormat).

For `%U`, all days in a new year preceding the first Sunday are considered to be in week 0. For `%W`, all days in a new year preceding the first Monday are considered to be in week 0. Week numbers are computed using [*interval*.count](https://github.com/d3/d3-time/blob/master/README.md#interval_count). For example, 2015-52 and 2016-00 represent Monday, December 28, 2015, while 2015-53 and 2016-01 represent Monday, January 4, 2016. This differs from the [ISO week date](https://en.wikipedia.org/wiki/ISO_week_date) specification (`%V`), which uses a more complicated definition!

For `%V`, per the [strftime man page](http://man7.org/linux/man-pages/man3/strftime.3.html):

> In this system, weeks start on a Monday, and are numbered from 01, for the first week, up to 52 or 53, for the last week.  Week 1 is the first week where four or more days fall within the new year (or, synonymously, week 01 is: the first week of the year that contains a Thursday; or, the week that has 4 January in it).

The `%` sign indicating a directive may be immediately followed by a padding modifier:

* `0` - zero-padding
* `_` - space-padding
* `-` - disable padding

If no padding modifier is specified, the default is `0` for all directives except `%e`, which defaults to `_`. (In some implementations of strftime and strptime, a directive may include an optional field width or precision; this feature is not yet implemented.)

The returned function formats a specified *[date](https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Date)*, returning the corresponding string.

```js
var formatMonth = d3.timeFormat("%B"),
    formatDay = d3.timeFormat("%A"),
    date = new Date(2014, 4, 1); // Thu May 01 2014 00:00:00 GMT-0700 (PDT)

formatMonth(date); // "May"
formatDay(date); // "Thursday"
```

<a name="locale_parse" href="#locale_parse">#</a> <i>locale</i>.<b>parse</b>(<i>specifier</i>) [<>](https://github.com/d3/d3-time-format/blob/master/src/locale.js#L298 "Source")

Returns a new parser for the given string *specifier*. The specifier string may contain the same directives as [*locale*.format](#locale_format). The `%d` and `%e` directives are considered equivalent for parsing.

The returned function parses a specified *string*, returning the corresponding [date](https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Date) or null if the string could not be parsed according to this format’s specifier. Parsing is strict: if the specified <i>string</i> does not exactly match the associated specifier, this method returns null. For example, if the associated specifier is `%Y-%m-%dT%H:%M:%SZ`, then the string `"2011-07-01T19:15:28Z"` will be parsed as expected, but `"2011-07-01T19:15:28"`, `"2011-07-01 19:15:28"` and `"2011-07-01"` will return null. (Note that the literal `Z` here is different from the time zone offset directive `%Z`.) If a more flexible parser is desired, try multiple formats sequentially until one returns non-null.

<a name="locale_utcFormat" href="#locale_utcFormat">#</a> <i>locale</i>.<b>utcFormat</b>(<i>specifier</i>) [<>](https://github.com/d3/d3-time-format/blob/master/src/locale.js#L303 "Source")

Equivalent to [*locale*.format](#locale_format), except all directives are interpreted as [Coordinated Universal Time (UTC)](https://en.wikipedia.org/wiki/Coordinated_Universal_Time) rather than local time.

<a name="locale_utcParse" href="#locale_utcParse">#</a> <i>locale</i>.<b>utcParse</b>(<i>specifier</i>) [<>](https://github.com/d3/d3-time-format/blob/master/src/locale.js#L308 "Source")

Equivalent to [*locale*.parse](#locale_parse), except all directives are interpreted as [Coordinated Universal Time (UTC)](https://en.wikipedia.org/wiki/Coordinated_Universal_Time) rather than local time.

### Locales

<a name="timeFormatLocale" href="#timeFormatLocale">#</a> d3.<b>timeFormatLocale</b>(<i>definition</i>) [<>](https://github.com/d3/d3-time-format/blob/master/src/locale.js "Source")

Returns a *locale* object for the specified *definition* with [*locale*.format](#locale_format), [*locale*.parse](#locale_parse), [*locale*.utcFormat](#locale_utcFormat), [*locale*.utcParse](#locale_utcParse) methods. The *definition* must include the following properties:

* `dateTime` - the date and time (`%c`) format specifier (<i>e.g.</i>, `"%a %b %e %X %Y"`).
* `date` - the date (`%x`) format specifier (<i>e.g.</i>, `"%m/%d/%Y"`).
* `time` - the time (`%X`) format specifier (<i>e.g.</i>, `"%H:%M:%S"`).
* `periods` - the A.M. and P.M. equivalents (<i>e.g.</i>, `["AM", "PM"]`).
* `days` - the full names of the weekdays, starting with Sunday.
* `shortDays` - the abbreviated names of the weekdays, starting with Sunday.
* `months` - the full names of the months (starting with January).
* `shortMonths` - the abbreviated names of the months (starting with January).

For an example, see [Localized Time Axis II](https://bl.ocks.org/mbostock/805115ebaa574e771db1875a6d828949).

<a name="timeFormatDefaultLocale" href="#timeFormatDefaultLocale">#</a> d3.<b>timeFormatDefaultLocale</b>(<i>definition</i>) [<>](https://github.com/d3/d3-time-format/blob/master/src/defaultLocale.js "Source")

Equivalent to [d3.timeFormatLocale](#timeFormatLocale), except it also redefines [d3.timeFormat](#timeFormat), [d3.timeParse](#timeParse), [d3.utcFormat](#utcFormat) and [d3.utcParse](#utcParse) to the new locale’s [*locale*.format](#locale_format), [*locale*.parse](#locale_parse), [*locale*.utcFormat](#locale_utcFormat) and [*locale*.utcParse](#locale_utcParse). If you do not set a default locale, it defaults to [U.S. English](https://github.com/d3/d3-time-format/blob/master/locale/en-US.json).

For an example, see [Localized Time Axis](https://bl.ocks.org/mbostock/6f1cc065d4d172bcaf322e399aa8d62f).
