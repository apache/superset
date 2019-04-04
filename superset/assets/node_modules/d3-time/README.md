# d3-time

When visualizing time series data, analyzing temporal patterns, or working with time in general, the irregularities of conventional time units quickly become apparent. In the [Gregorian calendar](https://en.wikipedia.org/wiki/Gregorian_calendar), for example, most months have 31 days but some have 28, 29 or 30; most years have 365 days but [leap years](https://en.wikipedia.org/wiki/Leap_year) have 366; and with [daylight saving](https://en.wikipedia.org/wiki/Daylight_saving_time), most days have 24 hours but some have 23 or 25. Adding to complexity, daylight saving conventions vary around the world.

As a result of these temporal peculiarities, it can be difficult to perform seemingly-trivial tasks. For example, if you want to compute the number of days that have passed between two dates, you can’t simply subtract and divide by 24 hours (86,400,000 ms):

```js
var start = new Date(2015, 02, 01), // Sun Mar 01 2015 00:00:00 GMT-0800 (PST)
    end = new Date(2015, 03, 01); // Wed Apr 01 2015 00:00:00 GMT-0700 (PDT)
(end - start) / 864e5; // 30.958333333333332, oops!
```

You can, however, use [d3.timeDay](#timeDay).[count](#interval_count):

```js
d3.timeDay.count(start, end); // 31
```

The [day](#day) [interval](#api-reference) is one of several provided by d3-time. Each interval represents a conventional unit of time—[hours](#timeHour), [weeks](#timeWeek), [months](#timeMonth), *etc.*—and has methods to calculate boundary dates. For example, [d3.timeDay](#timeDay) computes midnight (typically 12:00 AM local time) of the corresponding day. In addition to [rounding](#interval_round) and [counting](#interval_count), intervals can also be used to generate arrays of boundary dates. For example, to compute each Sunday in the current month:

```js
var now = new Date;
d3.timeWeek.range(d3.timeMonth.floor(now), d3.timeMonth.ceil(now));
// [Sun Jun 07 2015 00:00:00 GMT-0700 (PDT),
//  Sun Jun 14 2015 00:00:00 GMT-0700 (PDT),
//  Sun Jun 21 2015 00:00:00 GMT-0700 (PDT),
//  Sun Jun 28 2015 00:00:00 GMT-0700 (PDT)]
```

The d3-time module does not implement its own calendaring system; it merely implements a convenient API for calendar math on top of ECMAScript [Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date). Thus, it ignores leap seconds and can only work with the local time zone and [Coordinated Universal Time](https://en.wikipedia.org/wiki/Coordinated_Universal_Time) (UTC).

This module is used by D3’s time scales to generate sensible ticks, by D3’s time format, and can also be used directly to do things like [calendar layouts](http://bl.ocks.org/mbostock/4063318).

## Installing

If you use NPM, `npm install d3-time`. Otherwise, download the [latest release](https://github.com/d3/d3-time/releases/latest). You can also load directly from [d3js.org](https://d3js.org), either as a [standalone library](https://d3js.org/d3-time.v1.min.js) or as part of [D3 4.0](https://github.com/d3/d3). AMD, CommonJS, and vanilla environments are supported. In vanilla, a `d3` global is exported:

```html
<script src="https://d3js.org/d3-time.v1.min.js"></script>
<script>

var day = d3.timeDay(new Date);

</script>
```

[Try d3-time in your browser.](https://tonicdev.com/npm/d3-time)

## API Reference

<a name="_interval" href="#_interval">#</a> <i>interval</i>(<i>date</i>) [<>](https://github.com/d3/d3-time/blob/master/src/interval.js#L6 "Source")

Alias for [*interval*.floor](#interval_floor). For example, [d3.timeYear](#timeYear)(*date*) and d3.timeYear.floor(*date*) are equivalent.

<a name="interval_floor" href="#interval_floor">#</a> <i>interval</i>.<b>floor</b>(<i>date</i>) [<>](https://github.com/d3/d3-time/blob/master/src/interval.js#L10 "Source")

Returns a new date representing the latest interval boundary date before or equal to *date*. For example, [d3.timeDay](#timeDay).floor(*date*) typically returns 12:00 AM local time on the given *date*.

This method is idempotent: if the specified *date* is already floored to the current interval, a new date with an identical time is returned. Furthermore, the returned date is the minimum expressible value of the associated interval, such that *interval*.floor(*interval*.floor(*date*) - 1) returns the preceeding interval boundary date.

Note that the `==` and `===` operators do not compare by value with [Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date) objects, and thus you cannot use them to tell whether the specified *date* has already been floored. Instead, coerce to a number and then compare:

```js
// Returns true if the specified date is a day boundary.
function isDay(date) {
  return +d3.timeDay.floor(date) === +date;
}
```

This is more reliable than testing whether the time is 12:00 AM, as in some time zones midnight may not exist due to daylight saving.

<a name="interval_round" href="#interval_round">#</a> <i>interval</i>.<b>round</b>(<i>date</i>) [<>](https://github.com/d3/d3-time/blob/master/src/interval.js#L16 "Source")

Returns a new date representing the closest interval boundary date to *date*. For example, [d3.timeDay](#timeDay).round(*date*) typically returns 12:00 AM local time on the given *date* if it is on or before noon, and 12:00 AM of the following day if it is after noon.

This method is idempotent: if the specified *date* is already rounded to the current interval, a new date with an identical time is returned.

<a name="interval_ceil" href="#interval_ceil">#</a> <i>interval</i>.<b>ceil</b>(<i>date</i>) [<>](https://github.com/d3/d3-time/blob/master/src/interval.js#L12 "Source")

Returns a new date representing the earliest interval boundary date after or equal to *date*. For example, [d3.timeDay](#timeDay).ceil(*date*) typically returns 12:00 AM local time on the date following the given *date*.

This method is idempotent: if the specified *date* is already ceilinged to the current interval, a new date with an identical time is returned. Furthermore, the returned date is the maximum expressible value of the associated interval, such that *interval*.ceil(*interval*.ceil(*date*) + 1) returns the following interval boundary date.

<a name="interval_offset" href="#interval_offset">#</a> <i>interval</i>.<b>offset</b>(<i>date</i>[, <i>step</i>]) [<>](https://github.com/d3/d3-time/blob/master/src/interval.js#L22 "Source")

Returns a new date equal to *date* plus *step* intervals. If *step* is not specified it defaults to 1. If *step* is negative, then the returned date will be before the specified *date*; if *step* is zero, then a copy of the specified *date* is returned; if *step* is not an integer, it is [floored](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/floor). This method does not round the specified *date* to the interval. For example, if *date* is today at 5:34 PM, then [d3.timeDay](#timeDay).offset(*date*, 1) returns 5:34 PM tomorrow (even if daylight saving changes!).

<a name="interval_range" href="#interval_range">#</a> <i>interval</i>.<b>range</b>(<i>start</i>, <i>stop</i>[, <i>step</i>]) [<>](https://github.com/d3/d3-time/blob/master/src/interval.js#L26 "Source")

Returns an array of dates representing every interval boundary after or equal to *start* (inclusive) and before *stop* (exclusive). If *step* is specified, then every *step*th boundary will be returned; for example, for the [d3.timeDay](#timeDay) interval a *step* of 2 will return every other day. If *step* is not an integer, it is [floored](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/floor).

The first date in the returned array is the earliest boundary after or equal to *start*; subsequent dates are [offset](#interval_offset) by *step* intervals and [floored](#interval_floor). Thus, two overlapping ranges may be consistent. For example, this range contains odd days:

```js
d3.timeDay.range(new Date(2015, 0, 1), new Date(2015, 0, 7), 2);
// [Thu Jan 01 2015 00:00:00 GMT-0800 (PST),
//  Sat Jan 03 2015 00:00:00 GMT-0800 (PST),
//  Mon Jan 05 2015 00:00:00 GMT-0800 (PST)]
```

While this contains even days:

```js
d3.timeDay.range(new Date(2015, 0, 2), new Date(2015, 0, 8), 2);
// [Fri Jan 02 2015 00:00:00 GMT-0800 (PST),
//  Sun Jan 04 2015 00:00:00 GMT-0800 (PST),
//  Tue Jan 06 2015 00:00:00 GMT-0800 (PST)]
```

To make ranges consistent when a *step* is specified, use [*interval*.every](#interval_every) instead.

<a name="interval_filter" href="#interval_filter">#</a> <i>interval</i>.<b>filter</b>(<i>test</i>) [<>](https://github.com/d3/d3-time/blob/master/src/interval.js#L35 "Source")

Returns a new interval that is a filtered subset of this interval using the specified *test* function. The *test* function is passed a date and should return true if and only if the specified date should be considered part of the interval. For example, to create an interval that returns the 1st, 11th, 21th and 31th (if it exists) of each month:

```js
var i = d3.timeDay.filter(function(d) { return (d.getDate() - 1) % 10 === 0; });
```

The returned filtered interval does not support [*interval*.count](#interval_count). See also [*interval*.every](#interval_every).

<a name="interval_every" href="#interval_every">#</a> <i>interval</i>.<b>every</b>(<i>step</i>) [<>](https://github.com/d3/d3-time/blob/master/src/interval.js#L50 "Source")

Returns a [filtered](#interval_filter) view of this interval representing every *step*th date. The meaning of *step* is dependent on this interval’s parent interval as defined by the field function. For example, [d3.timeMinute](#timeMinute).every(15) returns an interval representing every fifteen minutes, starting on the hour: :00, :15, :30, :45, <i>etc.</i> Note that for some intervals, the resulting dates may not be uniformly-spaced; [d3.timeDay](#timeDay)’s parent interval is [d3.timeMonth](#timeMonth), and thus the interval number resets at the start of each month. If *step* is not valid, returns null. If *step* is one, returns this interval.

This method can be used in conjunction with [*interval*.range](#interval_range) to ensure that two overlapping ranges are consistent. For example, this range contains odd days:

```js
d3.timeDay.every(2).range(new Date(2015, 0, 1), new Date(2015, 0, 7));
// [Thu Jan 01 2015 00:00:00 GMT-0800 (PST),
//  Sat Jan 03 2015 00:00:00 GMT-0800 (PST),
//  Mon Jan 05 2015 00:00:00 GMT-0800 (PST)]
```

As does this one:

```js
d3.timeDay.every(2).range(new Date(2015, 0, 2), new Date(2015, 0, 8));
// [Sat Jan 03 2015 00:00:00 GMT-0800 (PST),
//  Mon Jan 05 2015 00:00:00 GMT-0800 (PST),
//  Wed Jan 07 2015 00:00:00 GMT-0800 (PST)]
```

The returned filtered interval does not support [*interval*.count](#interval_count). See also [*interval*.filter](#interval_filter).

<a name="interval_count" href="#interval_count">#</a> <i>interval</i>.<b>count</b>(<i>start</i>, <i>end</i>) [<>](https://github.com/d3/d3-time/blob/master/src/interval.js#L44 "Source")

Returns the number of interval boundaries after *start* (exclusive) and before or equal to *end* (inclusive). Note that this behavior is slightly different than [*interval*.range](#interval_range) because its purpose is to return the zero-based number of the specified *end* date relative to the specified *start* date. For example, to compute the current zero-based day-of-year number:

```js
var now = new Date;
d3.timeDay.count(d3.timeYear(now), now); // 177
```

Likewise, to compute the current zero-based week-of-year number for weeks that start on Sunday:

```js
d3.timeSunday.count(d3.timeYear(now), now); // 25
```

<a name="timeInterval" href="#timeInterval">#</a> d3.<b>timeInterval</b>(<i>floor</i>, <i>offset</i>[, <i>count</i>[, <i>field</i>]]) [<>](https://github.com/d3/d3-time/blob/master/src/interval.js#L4 "Source")

Constructs a new custom interval given the specified *floor* and *offset* functions and an optional *count* function.

The *floor* function takes a single date as an argument and rounds it down to the nearest interval boundary.

The *offset* function takes a date and an integer step as arguments and advances the specified date by the specified number of boundaries; the step may be positive, negative or zero.

The optional *count* function takes a start date and an end date, already floored to the current interval, and returns the number of boundaries between the start (exclusive) and end (inclusive). If a *count* function is not specified, the returned interval does not expose [*interval*.count](#interval_count) or [*interval*.every](#interval_every) methods. Note: due to an internal optimization, the specified *count* function must not invoke *interval*.count on other time intervals.

The optional *field* function takes a date, already floored to the current interval, and returns the field value of the specified date, corresponding to the number of boundaries between this date (exclusive) and the latest previous parent boundary. For example, for the [d3.timeDay](#timeDay) interval, this returns the number of days since the start of the month. If a *field* function is not specified, it defaults to counting the number of interval boundaries since the UNIX epoch of January 1, 1970 UTC. The *field* function defines the behavior of [*interval*.every](#interval_every).

### Intervals

The following intervals are provided:

<a name="timeMillisecond" href="#timeMillisecond">#</a> d3.<b>timeMillisecond</b> [<>](https://github.com/d3/d3-time/blob/master/src/millisecond.js "Source")
<br><a href="#timeMillisecond">#</a> d3.<b>utcMillisecond</b>

Milliseconds; the shortest available time unit.

<a name="timeSecond" href="#timeSecond">#</a> d3.<b>timeSecond</b> [<>](https://github.com/d3/d3-time/blob/master/src/second.js "Source")
<br><a href="#timeSecond">#</a> d3.<b>utcSecond</b>

Seconds (e.g., 01:23:45.0000 AM); 1,000 milliseconds.

<a name="timeMinute" href="#timeMinute">#</a> d3.<b>timeMinute</b> [<>](https://github.com/d3/d3-time/blob/master/src/minute.js "Source")
<br><a href="#timeMinute">#</a> d3.<b>utcMinute</b> [<>](https://github.com/d3/d3-time/blob/master/src/utcMinute.js "Source")

Minutes (e.g., 01:02:00 AM); 60 seconds. Note that ECMAScript [ignores leap seconds](http://www.ecma-international.org/ecma-262/5.1/#sec-15.9.1.1).

<a name="timeHour" href="#timeHour">#</a> d3.<b>timeHour</b> [<>](https://github.com/d3/d3-time/blob/master/src/hour.js "Source")
<br><a href="#timeHour">#</a> d3.<b>utcHour</b> [<>](https://github.com/d3/d3-time/blob/master/src/utcHour.js "Source")

Hours (e.g., 01:00 AM); 60 minutes. Note that advancing time by one hour in local time can return the same hour or skip an hour due to daylight saving.

<a name="timeDay" href="#timeDay">#</a> d3.<b>timeDay</b> [<>](https://github.com/d3/d3-time/blob/master/src/day.js "Source")
<br><a href="#timeDay">#</a> d3.<b>utcDay</b> [<>](https://github.com/d3/d3-time/blob/master/src/utcDay.js "Source")

Days (e.g., February 7, 2012 at 12:00 AM); typically 24 hours. Days in local time may range from 23 to 25 hours due to daylight saving.

<a name="timeWeek" href="#timeWeek">#</a> d3.<b>timeWeek</b> [<>](https://github.com/d3/d3-time/blob/master/src/week.js "Source")
<br><a href="#timeWeek">#</a> d3.<b>utcWeek</b> [<>](https://github.com/d3/d3-time/blob/master/src/utcWeek.js "Source")

Alias for [d3.timeSunday](#timeSunday); 7 days and typically 168 hours. Weeks in local time may range from 167 to 169 hours due on daylight saving.

<a name="timeSunday" href="#timeSunday">#</a> d3.<b>timeSunday</b> [<>](https://github.com/d3/d3-time/blob/master/src/week.js#L15 "Source")
<br><a href="#timeSunday">#</a> d3.<b>utcSunday</b> [<>](https://github.com/d3/d3-time/blob/master/src/utcWeek.js#L15 "Source")

Sunday-based weeks (e.g., February 5, 2012 at 12:00 AM).

<a name="timeMonday" href="#timeMonday">#</a> d3.<b>timeMonday</b> [<>](https://github.com/d3/d3-time/blob/master/src/week.js#L16 "Source")
<br><a href="#timeMonday">#</a> d3.<b>utcMonday</b> [<>](https://github.com/d3/d3-time/blob/master/src/utcWeek.js#L16 "Source")

Monday-based weeks (e.g., February 6, 2012 at 12:00 AM).

<a name="timeTuesday" href="#timeTuesday">#</a> d3.<b>timeTuesday</b> [<>](https://github.com/d3/d3-time/blob/master/src/week.js#L17 "Source")
<br><a href="#timeTuesday">#</a> d3.<b>utcTuesday</b> [<>](https://github.com/d3/d3-time/blob/master/src/utcWeek.js#L17 "Source")

Tuesday-based weeks (e.g., February 7, 2012 at 12:00 AM).

<a name="timeWednesday" href="#timeWednesday">#</a> d3.<b>timeWednesday</b> [<>](https://github.com/d3/d3-time/blob/master/src/week.js#L18 "Source")
<br><a href="#timeWednesday">#</a> d3.<b>utcWednesday</b> [<>](https://github.com/d3/d3-time/blob/master/src/utcWeek.js#L18 "Source")

Wednesday-based weeks (e.g., February 8, 2012 at 12:00 AM).

<a name="timeThursday" href="#timeThursday">#</a> d3.<b>timeThursday</b> [<>](https://github.com/d3/d3-time/blob/master/src/week.js#L19 "Source")
<br><a href="#timeThursday">#</a> d3.<b>utcThursday</b> [<>](https://github.com/d3/d3-time/blob/master/src/utcWeek.js#L19 "Source")

Thursday-based weeks (e.g., February 9, 2012 at 12:00 AM).

<a name="timeFriday" href="#timeFriday">#</a> d3.<b>timeFriday</b> [<>](https://github.com/d3/d3-time/blob/master/src/week.js#L20 "Source")
<br><a href="#timeFriday">#</a> d3.<b>utcFriday</b> [<>](https://github.com/d3/d3-time/blob/master/src/utcWeek.js#L20 "Source")

Friday-based weeks (e.g., February 10, 2012 at 12:00 AM).

<a name="timeSaturday" href="#timeSaturday">#</a> d3.<b>timeSaturday</b> [<>](https://github.com/d3/d3-time/blob/master/src/week.js#L21 "Source")
<br><a href="#timeSaturday">#</a> d3.<b>utcSaturday</b> [<>](https://github.com/d3/d3-time/blob/master/src/utcWeek.js#L21 "Source")

Saturday-based weeks (e.g., February 11, 2012 at 12:00 AM).

<a name="timeMonth" href="#timeMonth">#</a> d3.<b>timeMonth</b> [<>](https://github.com/d3/d3-time/blob/master/src/month.js "Source")
<br><a href="#timeMonth">#</a> d3.<b>utcMonth</b> [<>](https://github.com/d3/d3-time/blob/master/src/utcMonth.js "Source")

Months (e.g., February 1, 2012 at 12:00 AM); ranges from 28 to 31 days.

<a name="timeYear" href="#timeYear">#</a> d3.<b>timeYear</b> [<>](https://github.com/d3/d3-time/blob/master/src/year.js "Source")
<br><a href="#timeYear">#</a> d3.<b>utcYear</b> [<>](https://github.com/d3/d3-time/blob/master/src/utcYear.js "Source")

Years (e.g., January 1, 2012 at 12:00 AM); ranges from 365 to 366 days.

### Ranges

For convenience, aliases for [*interval*.range](#interval_range) are also provided as plural forms of the corresponding interval.

<a name="timeMilliseconds" href="#timeMilliseconds">#</a> d3.<b>timeMilliseconds</b>(<i>start</i>, <i>stop</i>[, <i>step</i>]) [<>](https://github.com/d3/d3-time/blob/master/src/millisecond.js#L26 "Source")
<br><a href="#timeMilliseconds">#</a> d3.<b>utcMilliseconds</b>(<i>start</i>, <i>stop</i>[, <i>step</i>])

Aliases for [d3.timeMillisecond](#timeMillisecond).[range](#interval_range) and [d3.utcMillisecond](#timeMillisecond).[range](#interval_range).

<a name="timeSeconds" href="#timeSeconds">#</a> d3.<b>timeSeconds</b>(<i>start</i>, <i>stop</i>[, <i>step</i>]) [<>](https://github.com/d3/d3-time/blob/master/src/second.js#L15 "Source")
<br><a href="#timeSeconds">#</a> d3.<b>utcSeconds</b>(<i>start</i>, <i>stop</i>[, <i>step</i>])

Aliases for [d3.timeSecond](#timeSecond).[range](#interval_range) and [d3.utcSecond](#timeSecond).[range](#interval_range).

<a name="timeMinutes" href="#timeMinutes">#</a> d3.<b>timeMinutes</b>(<i>start</i>, <i>stop</i>[, <i>step</i>]) [<>](https://github.com/d3/d3-time/blob/master/src/minute.js#L15 "Source")
<br><a href="#timeMinutes">#</a> d3.<b>utcMinutes</b>(<i>start</i>, <i>stop</i>[, <i>step</i>]) [<>](https://github.com/d3/d3-time/blob/master/src/utcMinute.js#L15 "Source")

Aliases for [d3.timeMinute](#timeMinute).[range](#interval_range) and [d3.utcMinute](#timeMinute).[range](#interval_range).

<a name="timeHours" href="#timeHours">#</a> d3.<b>timeHours</b>(<i>start</i>, <i>stop</i>[, <i>step</i>]) [<>](https://github.com/d3/d3-time/blob/master/src/hour.js#L17 "Source")
<br><a href="#timeHours">#</a> d3.<b>utcHours</b>(<i>start</i>, <i>stop</i>[, <i>step</i>]) [<>](https://github.com/d3/d3-time/blob/master/src/utcHour.js#L15 "Source")

Aliases for [d3.timeHour](#timeHour).[range](#interval_range) and [d3.utcHour](#timeHour).[range](#interval_range).

<a name="timeDays" href="#timeDays">#</a> d3.<b>timeDays</b>(<i>start</i>, <i>stop</i>[, <i>step</i>]) [<>](https://github.com/d3/d3-time/blob/master/src/day.js#L15 "Source")
<br><a href="#timeDays">#</a> d3.<b>utcDays</b>(<i>start</i>, <i>stop</i>[, <i>step</i>]) [<>](https://github.com/d3/d3-time/blob/master/src/utcDay.js#L15 "Source")

Aliases for [d3.timeDay](#timeDay).[range](#interval_range) and [d3.utcDay](#timeDay).[range](#interval_range).

<a name="timeWeeks" href="#timeWeeks">#</a> d3.<b>timeWeeks</b>(<i>start</i>, <i>stop</i>[, <i>step</i>])
<br><a href="#timeWeeks">#</a> d3.<b>utcWeeks</b>(<i>start</i>, <i>stop</i>[, <i>step</i>])

Aliases for [d3.timeWeek](#timeWeek).[range](#interval_range) and [d3.utcWeek](#timeWeek).[range](#interval_range).

<a name="timeSundays" href="#timeSundays">#</a> d3.<b>timeSundays</b>(<i>start</i>, <i>stop</i>[, <i>step</i>]) [<>](https://github.com/d3/d3-time/blob/master/src/week.js#L23 "Source")
<br><a href="#timeSundays">#</a> d3.<b>utcSundays</b>(<i>start</i>, <i>stop</i>[, <i>step</i>]) [<>](https://github.com/d3/d3-time/blob/master/src/utcWeek.js#L23 "Source")

Aliases for [d3.timeSunday](#timeSunday).[range](#interval_range) and [d3.utcSunday](#timeSunday).[range](#interval_range).

<a name="timeMondays" href="#timeMondays">#</a> d3.<b>timeMondays</b>(<i>start</i>, <i>stop</i>[, <i>step</i>]) [<>](https://github.com/d3/d3-time/blob/master/src/week.js#L24 "Source")
<br><a href="#timeMondays">#</a> d3.<b>utcMondays</b>(<i>start</i>, <i>stop</i>[, <i>step</i>]) [<>](https://github.com/d3/d3-time/blob/master/src/utcWeek.js#L24 "Source")

Aliases for [d3.timeMonday](#timeMonday).[range](#interval_range) and [d3.utcMonday](#timeMonday).[range](#interval_range).

<a name="timeTuesdays" href="#timeTuesdays">#</a> d3.<b>timeTuesdays</b>(<i>start</i>, <i>stop</i>[, <i>step</i>]) [<>](https://github.com/d3/d3-time/blob/master/src/week.js#L25 "Source")
<br><a href="#timeTuesdays">#</a> d3.<b>utcTuesdays</b>(<i>start</i>, <i>stop</i>[, <i>step</i>]) [<>](https://github.com/d3/d3-time/blob/master/src/utcWeek.js#L25 "Source")

Aliases for [d3.timeTuesday](#timeTuesday).[range](#interval_range) and [d3.utcTuesday](#timeTuesday).[range](#interval_range).

<a name="timeWednesdays" href="#timeWednesdays">#</a> d3.<b>timeWednesdays</b>(<i>start</i>, <i>stop</i>[, <i>step</i>]) [<>](https://github.com/d3/d3-time/blob/master/src/week.js#L26 "Source")
<br><a href="#timeWednesdays">#</a> d3.<b>utcWednesdays</b>(<i>start</i>, <i>stop</i>[, <i>step</i>]) [<>](https://github.com/d3/d3-time/blob/master/src/utcWeek.js#L26 "Source")

Aliases for [d3.timeWednesday](#timeWednesday).[range](#interval_range) and [d3.utcWednesday](#timeWednesday).[range](#interval_range).

<a name="timeThursdays" href="#timeThursdays">#</a> d3.<b>timeThursdays</b>(<i>start</i>, <i>stop</i>[, <i>step</i>]) [<>](https://github.com/d3/d3-time/blob/master/src/week.js#L27 "Source")
<br><a href="#timeThursdays">#</a> d3.<b>utcThursdays</b>(<i>start</i>, <i>stop</i>[, <i>step</i>]) [<>](https://github.com/d3/d3-time/blob/master/src/utcWeek.js#L27 "Source")

Aliases for [d3.timeThursday](#timeThursday).[range](#interval_range) and [d3.utcThursday](#timeThursday).[range](#interval_range).

<a name="timeFridays" href="#timeFridays">#</a> d3.<b>timeFridays</b>(<i>start</i>, <i>stop</i>[, <i>step</i>]) [<>](https://github.com/d3/d3-time/blob/master/src/week.js#L28 "Source")
<br><a href="#timeFridays">#</a> d3.<b>utcFridays</b>(<i>start</i>, <i>stop</i>[, <i>step</i>]) [<>](https://github.com/d3/d3-time/blob/master/src/utcWeek.js#L28 "Source")

Aliases for [d3.timeFriday](#timeFriday).[range](#interval_range) and [d3.utcFriday](#timeFriday).[range](#interval_range).

<a name="timeSaturdays" href="#timeSaturdays">#</a> d3.<b>timeSaturdays</b>(<i>start</i>, <i>stop</i>[, <i>step</i>]) [<>](https://github.com/d3/d3-time/blob/master/src/week.js#L29 "Source")
<br><a href="#timeSaturdays">#</a> d3.<b>utcSaturdays</b>(<i>start</i>, <i>stop</i>[, <i>step</i>]) [<>](https://github.com/d3/d3-time/blob/master/src/utcWeek.js#L29 "Source")

Aliases for [d3.timeSaturday](#timeSaturday).[range](#interval_range) and [d3.utcSaturday](#timeSaturday).[range](#interval_range).

<a name="timeMonths" href="#timeMonths">#</a> d3.<b>timeMonths</b>(<i>start</i>, <i>stop</i>[, <i>step</i>]) [<>](https://github.com/d3/d3-time/blob/master/src/month.js#L15 "Source")
<br><a href="#timeMonths">#</a> d3.<b>utcMonths</b>(<i>start</i>, <i>stop</i>[, <i>step</i>]) [<>](https://github.com/d3/d3-time/blob/master/src/utcMonth.js#L15 "Source")

Aliases for [d3.timeMonth](#timeMonth).[range](#interval_range) and [d3.utcMonth](#timeMonth).[range](#interval_range).

<a name="timeYears" href="#timeYears">#</a> d3.<b>timeYears</b>(<i>start</i>, <i>stop</i>[, <i>step</i>]) [<>](https://github.com/d3/d3-time/blob/master/src/year.js#L26 "Source")
<br><a href="#timeYears">#</a> d3.<b>utcYears</b>(<i>start</i>, <i>stop</i>[, <i>step</i>]) [<>](https://github.com/d3/d3-time/blob/master/src/utcYear.js#L26 "Source")

Aliases for [d3.timeYear](#timeYear).[range](#interval_range) and [d3.utcYear](#timeYear).[range](#interval_range).
