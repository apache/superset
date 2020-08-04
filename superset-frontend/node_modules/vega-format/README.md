# vega-format

String formatting utilities for number and date values.

## API Reference

- [Number Format Locale](#number-format-locale)
- [Time Format Locale](#time-format-locale)
- [Combined Locale](#combined-locale)

### Number Format Locale

<a name="numberFormatLocale" href="#numberFormatLocale">#</a>
vega.<b>numberFormatLocale</b>(<i>definition</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-format/src/number.js "Source")

Returns a locale object with methods for number formatting, based on the provided *definition*. The *definition* argument must match the format expected by [d3-format](https://github.com/d3/d3-format#formatLocale). For examples of definition files for a variety of languages, see the [d3-format locale collection](https://github.com/d3/d3-format/tree/master/locale).

<a name="format" href="#format">#</a>
locale.<b>format</b>([<i>specifier</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-format/src/number.js "Source")

Returns a function that takes a number as input and returns a formatted string. If a string-valued format _specifier_ is provided, it must follow the [d3-format](https://github.com/d3/d3-format/#locale_format) syntax. The returned function is akin to d3-format's [format](https://github.com/d3/d3-format/#format) method.

<a name="formatPrefix" href="#formatPrefix">#</a>
locale.<b>formatPrefix</b>(<i>specifier</i>, <i>value</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-format/src/number.js "Source")

Returns a function that takes a number as input and returns a formatted string, with a fixed SI prefix anchored at the provided value. The string-valued format _specifier_ must follow the [d3-format](https://github.com/d3/d3-format/#locale_format) syntax. The returned function is akin to d3-format's [formatPrefix](https://github.com/d3/d3-format/#formatPrefix) method.

<a name="formatFloat" href="#formatFloat">#</a>
locale.<b>formatFloat</b>([<i>specifier</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-format/src/number.js "Source")

Returns a function that takes a number as input and returns a formatted string. This method is similar to the [format](#format) method, except that if the specifier does not provide a precision, the returned formatter will use a variable (floating) precision depending on the number of significant digits. Vega uses this method to provide improved formatting for values plotted on a logarithmic scale.

<a name="formatSpan" href="#formatSpan">#</a>
locale.<b>formatSpan</b>(<i>start</i>, <i>stop</i>, <i>count</i>[, <i>specifier</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-format/src/number.js "Source")

Returns a function that takes a number as input and returns a formatted string appropriate for a specified span of numbers defined by *start* and *stop* values and a *count* of values in the range. Based on these values, the method will attempt to find an appropriate precision. For example, to format 20 numbers on the range [0, 10], a precision of 0.1 (`'0.1f'`) will be used. An optional *specifier* can be used to further customize the format; if the *specifier* includes a numeric precision that value will override the span-based precision.

<a name="numberFormatDefaultLocale" href="#numberFormatDefaultLocale">#</a>
vega.<b>numberFormatDefaultLocale</b>([<i>definition</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-format/src/number.js "Source")

Get or set the default locale for number formatting. If no arguments are provided, returns the current default locale. Otherwise, sets the default locale based on the provided *definition*, and returns the resulting locale object. The input definitions should be of the same type accepted by the [numberFormatLocale](#numberFormatLocale) method.

<a name="resetNumberFormatDefaultLocale" href="#resetNumberFormatDefaultLocale">#</a>
vega.<b>resetNumberFormatDefaultLocale</b>()
[<>](https://github.com/vega/vega/blob/master/packages/vega-format/src/number.js "Source")

Resets the default locale for number formatting and returns the resulting locale object. The new default number locale for Vega will match the current default locale for the underlying d3-format library.

### Time Format Locale

<a name="timeFormatLocale" href="#timeFormatLocale">#</a>
vega.<b>timeFormatLocale</b>(<i>definition</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-format/src/time.js "Source")

Returns a locale object with methods for time formatting, based on the provided *definition*. The *definition* argument must match the format expected by [d3-time-format](https://github.com/d3/d3-time-format#timeFormatLocale). For examples of definition files for a variety of languages, see the [d3-time-format locale collection](https://github.com/d3/d3-time-format/tree/master/locale).

<a name="timeFormat" href="#timeFormat">#</a>
locale.<b>timeFormat</b>([<i>specifier</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-format/src/time.js "Source")

Returns a function that takes a date or timestamp as input and returns a formatted string in the local timezone. If a string-valued format _specifier_ is provided, it must follow the [d3-time-format](https://github.com/d3/d3-time-format/#locale_format) syntax. The returned function is akin to d3-time-format's [timeFormat](https://github.com/d3/d3-time-format/#timeFormat) method.

If an object-valued _specifier_ is provided, a multi-format function will be generated, which selects among different format specifiers based on the granularity of the input date value (that is, values residing on a year, month, date, _etc._, boundary can all be formatted differently). The input object should use proper time unit strings for keys. If no time format _specifier_ is provided, a default multi-format function is returned, equivalent to using the following _specifier_:

```json
{
  "year": "%Y",
  "quarter": "%B",
  "month": "%B",
  "week": "%b %d",
  "date": "%a %d",
  "hours": "%I %p",
  "minutes": "%I:%M",
  "seconds": ":%S",
  "milliseconds": ".%L"
}
```

If an input _specifier_ object omits any of these key values, a default value will be used. Note that for this method the `"date"` and `"day"` units are interchangeable; if both are defined the `"date"` entry take precedence.

<a name="utcFormat" href="#utcFormat">#</a>
locale.<b>utcFormat</b>([<i>specifier</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-format/src/time.js "Source")

Returns a function that takes a date or timestamp as input and returns a formatted string in [Coordinated Universal Time](https://en.wikipedia.org/wiki/Coordinated_Universal_Time) (UTC). If a string-valued format _specifier_ is provided, it must follow the [d3-time-format](https://github.com/d3/d3-time-format/#locale_format) syntax. The returned function is akin to d3-time-format's [utcFormat](https://github.com/d3/d3-time-format/#utcFormat) method.

This method also accepts object-valued _specifiers_ for creating multi-format functions. If no argumennts are provided, a defualt multi-format function will be returned. For more details, see the [timeFormat](#timeFormat) method documentation.

<a name="timeParse" href="#timeParse">#</a>
locale.<b>timeParse</b>(<i>specifier</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-format/src/time.js "Source")

Returns a function that takes a string as input and returns a date. The string-valued format _specifier_ must follow the [d3-time-format](https://github.com/d3/d3-time-format/#locale_format) syntax. The returned function is akin to d3-time-format's [timeParse](https://github.com/d3/d3-time-format/#timeParse) method.

<a name="utcParse" href="#utcParse">#</a>
locale.<b>utcParse</b>(<i>specifier</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-format/src/time.js "Source")

Returns a function that takes a string as input and returns a date in [Coordinated Universal Time](https://en.wikipedia.org/wiki/Coordinated_Universal_Time) (UTC). The string-valued format _specifier_ must follow the [d3-time-format](https://github.com/d3/d3-time-format/#locale_format) syntax. The returned function is akin to d3-time-format's [utcParse](https://github.com/d3/d3-time-format/#utcParse) method.

<a name="timeFormatDefaultLocale" href="#timeFormatDefaultLocale">#</a>
vega.<b>timeFormatDefaultLocale</b>([<i>definition</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-format/src/time.js "Source")

Get or set the default locale for time formatting. If no arguments are provided, returns the current default locale. Otherwise, sets the default locale based on the provided *definition*, and returns the resulting locale object. The input definitions should be of the same type accepted by the [timeFormatLocale](#timeFormatLocale) method.

<a name="resetTimeFormatDefaultLocale" href="#resetTimeFormatDefaultLocale">#</a>
vega.<b>resetTimeFormatDefaultLocale</b>()
[<>](https://github.com/vega/vega/blob/master/packages/vega-format/src/time.js "Source")

Resets the default locale for time formatting and returns the resulting locale object. The new default time locale for Vega will match the current default locale for the underlying d3-time-format library.

### Combined Locale

Combined locale objects provide a convenient abstraction for both number and time formatting methods defined on a single object. A combined locale object contains the methods of both a number format locale object and a time format locale object.

<a name="locale" href="#locale">#</a>
vega.<b>locale</b>(<i>numberDefinition</i>, <i>timeDefinition</i>)
[<>](https://github.com/vega/vega/blob/master/packages/vega-format/src/locale.js "Source")

Returns a combined locale object with methods for both number and time formatting, based on the provided *numberDefinition* and *timeDefinition*. The definition arguments must match the format expected by [d3-format](https://github.com/d3/d3-format#formatLocale) and [d3-time-format](https://github.com/d3/d3-time-format#timeFormatLocale). If either argument is null or unspecified, the corresponding default locale is used instead. For examples of definition files for a variety of languages, see the [d3-format locale collection](https://github.com/d3/d3-format/tree/master/locale) and [d3-time-format locale collection](https://github.com/d3/d3-time-format/tree/master/locale).

<a name="defaultLocale" href="#defaultLocale">#</a>
vega.<b>defaultLocale</b>([<i>numberDefinition</i>, <i>timeDefinition</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-format/src/locale.js "Source")

Get or set the default locale for both number and time formatting. If no arguments are provided, returns the current default locale. Otherwise, sets the default locales based on the provided *numberDefinition* and *timeDefinition*, and returns the resulting combined locale object. The input definitions should be of the same type accepted by the [locale](#locale) method.

<a name="resetDefaultLocale" href="#resetDefaultLocale">#</a>
vega.<b>resetDefaultLocale</b>()
[<>](https://github.com/vega/vega/blob/master/packages/vega-format/src/locale.js "Source")

Resets the default locale for both number and time formatting and returns the resulting comgined locale object. The new default locales for Vega will match the current default locales for the underlying d3-format and d3-time-format libraries.
