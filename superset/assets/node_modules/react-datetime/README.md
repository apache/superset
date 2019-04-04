# react-datetime

[![Build Status](https://secure.travis-ci.org/YouCanBookMe/react-datetime.svg)](https://travis-ci.org/YouCanBookMe/react-datetime)
[![npm version](https://badge.fury.io/js/react-datetime.svg)](http://badge.fury.io/js/react-datetime)

A date and time picker in the same React.js component. It can be used as a datepicker, timepicker or both at the same time. It is **highly customizable** and it even allows to edit date's milliseconds.

This project started as a fork of https://github.com/quri/react-bootstrap-datetimepicker but the code and the API has changed a lot.

## Installation

Install using npm:
```sh
npm install --save react-datetime
```

Install using yarn:
```sh
yarn add react-datetime
```

## Usage

[React.js](http://facebook.github.io/react/) and [Moment.js](http://momentjs.com/) are peer dependencies for react-datetime (as well as [Moment.js timezones](https://momentjs.com/timezone/) if you want to use the `displayTimeZone` prop). These dependencies are not installed along with react-datetime automatically, but your project needs to have them installed in order to make the datepicker work. You can then use the datepicker like in the example below.


```js
require('react-datetime');

...

render: function() {
    return <Datetime />;
}
```
[See this example working](http://codepen.io/simeg/pen/mEmQmP).

**Don't forget to add the [CSS stylesheet](https://github.com/YouCanBookMe/react-datetime/blob/master/css/react-datetime.css) to make it work out of the box.**

## API

| Name         | Type    | Default | Description |
| ------------ | ------- | ------- | ----------- |
| **value** | `Date` | `new Date()` | Represents the selected date by the component, in order to use it as a [controlled component](https://facebook.github.io/react/docs/forms.html#controlled-components). This prop is parsed by Moment.js, so it is possible to use a date `string` or a `moment` object. |
| **defaultValue** | `Date` | `new Date()` | Represents the selected date for the component to use it as a [uncontrolled component](https://facebook.github.io/react/docs/uncontrolled-components.html). This prop is parsed by Moment.js, so it is possible to use a date `string` or a `moment` object. |
| **viewDate** | `Date` | `new Date()` | Represents the month which is viewed on opening the calendar when there is no selected date. This prop is parsed by Moment.js, so it is possible to use a date `string` or a `moment` object. |
| **dateFormat**   | `boolean` or `string`  | `true` | Defines the format for the date. It accepts any [Moment.js date format](http://momentjs.com/docs/#/displaying/format/) (not in localized format). If `true` the date will be displayed using the defaults for the current locale. If `false` the datepicker is disabled and the component can be used as timepicker, see [available units docs](#specify-available-units). |
| **timeFormat**   | `boolean` or `string`  | `true` | Defines the format for the time. It accepts any [Moment.js time format](http://momentjs.com/docs/#/displaying/format/) (not in localized format). If `true` the time will be displayed using the defaults for the current locale. If `false` the timepicker is disabled and the component can be used as datepicker, see [available units docs](#specify-available-units). |
| **input** | `boolean` | `true` | Whether to show an input field to edit the date manually. |
| **open** | `boolean` | `null` | Whether to open or close the picker. If not set react-datetime will open the datepicker on input focus and close it on click outside. |
| **locale** | `string` | `null` | Manually set the locale for the react-datetime instance. Moment.js locale needs to be loaded to be used, see [i18n docs](#i18n).
| **utc** | `boolean` | `false` | When true, input time values will be interpreted as UTC (Zulu time) by Moment.js. Otherwise they will default to the user's local timezone.
| **displayTimeZone** | `string` | `null` | **Needs [moment's timezone](https://momentjs.com/timezone/) available in your project.** When specified, input time values will be displayed in the given time zone. Otherwise they will default to the user's local timezone (unless `utc` specified).
| **onChange** | `function` | empty function | Callback trigger when the date changes. The callback receives the selected `moment` object as only parameter, if the date in the input is valid. If the date in the input is not valid, the callback receives the value of the input (a string). |
| **onFocus** | `function` | empty function | Callback trigger for when the user opens the datepicker. The callback receives an event of type SyntheticEvent. |
| **onBlur** | `function` | empty function | Callback trigger for when the user clicks outside of the input, simulating a regular onBlur. The callback receives the selected `moment` object as only parameter, if the date in the input is valid. If the date in the input is not valid, the callback returned. |
| **onViewModeChange** | `function` | empty function | Callback trigger when the view mode changes. The callback receives the selected view mode string (`years`, `months`, `days` or `time`) as only parameter.|
| **onNavigateBack** | `function` | empty function | Callback trigger when the user navigates to the previous month, year or decade. The callback receives the amount and type ('month', 'year') as parameters. |
| **onNavigateForward** | `function` | empty function | Callback trigger when the user navigates to the next month, year or decade. The callback receives the amount and type ('month', 'year') as parameters. |
| **viewMode** | `string` or `number` | `'days'` | The default view to display when the picker is shown (`'years'`, `'months'`, `'days'`, `'time'`). |
| **className** | `string` or `string array` | `''` | Extra class name for the outermost markup element. |
| **inputProps** | `object` | `undefined` | Defines additional attributes for the input element of the component. For example: `onClick`, `placeholder`, `disabled`, `required`, `name` and `className` (`className` *sets* the class attribute for the input element). See [Customize the Input Appearance](#customize-the-input-appearance). |
| **isValidDate** | `function` | `() => true` | Define the dates that can be selected. The function receives `(currentDate, selectedDate)` and shall return a `true` or `false` whether the `currentDate` is valid or not. See [selectable dates](#selectable-dates).|
| **renderInput** | `function` | `undefined` | Replace the rendering of the input element. The function has the following arguments: the default calculated `props` for the input, `openCalendar` (a function which opens the calendar) and `closeCalendar` (a function which closes the calendar). Must return a React component or `null`. See [Customize the Input Appearance](#customize-the-input-appearance). |
| **renderDay** | `function` | `DOM.td(day)` | Customize the way that the days are shown in the daypicker. The accepted function has the `selectedDate`, the current date and the default calculated `props` for the cell, and must return a React component. See [Customize the Datepicker Appearance](#customize-the-datepicker-appearance). |
| **renderMonth** | `function` | `DOM.td(month)` | Customize the way that the months are shown in the monthpicker. The accepted function has the `selectedDate`, the current date and the default calculated `props` for the cell, the `month` and the `year` to be shown, and must return a React component. See [Customize the Datepicker Appearance](#customize-the-datepicker-appearance). |
| **renderYear** | `function` | `DOM.td(year)` | Customize the way that the years are shown in the year picker. The accepted function has the `selectedDate`, the current date and the default calculated `props` for the cell, the `year` to be shown, and must return a React component. See [Customize the Datepicker Appearance](#customize-the-datepicker-appearance). |
| **strictParsing** | `boolean` | `true` | Whether to use Moment.js's [strict parsing](http://momentjs.com/docs/#/parsing/string-format/) when parsing input.
| **closeOnSelect** | `boolean` | `false` | When `true`, once the day has been selected, the datepicker will be automatically closed.
| **closeOnTab** | `boolean` | `true` | When `true` and the input is focused, pressing the `tab` key will close the datepicker.
| **timeConstraints** | `object` | `null` | Add some constraints to the timepicker. It accepts an `object` with the format `{ hours: { min: 9, max: 15, step: 2 }}`, this example means the hours can't be lower than `9` and higher than `15`, and it will change adding or subtracting `2` hours everytime the buttons are clicked. The constraints can be added to the `hours`, `minutes`, `seconds` and `milliseconds`.
| **disableCloseOnClickOutside** | `boolean` | `false` | When `true`, keep the datepicker open when click event is triggered outside of component. When `false`, close it.

## i18n
Different language and date formats are supported by react-datetime. React uses [Moment.js](http://momentjs.com/) to format the dates, and the easiest way of changing the language of the calendar is [changing the Moment.js locale](http://momentjs.com/docs/#/i18n/changing-locale/).

```js
var moment = require('moment');
require('moment/locale/fr');
// Now react-datetime will be in french
```

If there are multiple locales loaded, you can use the prop `locale` to define what language shall be used by the instance.
```js
<Datetime locale="fr-ca" />
<Datetime locale="de" />
```
[Here you can see the i18n example working](http://codepen.io/simeg/pen/yVVjdJ).

## Customize the Input Appearance
It is possible to customize the way that the input is displayed. The simplest is to supply `inputProps` which get assigned to the default `<input />` element within the component.

```js
<Datetime inputProps={{ placeholder: 'N/A', disabled: true }}>
```

Alternatively, if you need to render different content than an `<input />` element, you may supply a `renderInput` function which is called instead.

```js
var MyDTPicker = React.createClass({
    render: function(){
        return <Datetime renderInput={ this.renderInput } />;
    },
    renderInput: function( props, openCalendar, closeCalendar ){
        function clear(){
            props.onChange({target: {value: ''}});
        }
        return (
            <div>
                <input {...props} />
                <button onClick={openCalendar}>open calendar</button>
                <button onClick={closeCalendar}>close calendar</button>
                <button onClick={clear}>clear</button>
            </div>
        );
    },
});
```

## Customize the Datepicker Appearance
It is possible to customize the way that the datepicker display the days, months and years in the calendar. To adapt the calendar for every need it is possible to use the props `renderDay(props, currentDate, selectedDate)`, `renderMonth(props, month, year, selectedDate)` and `renderYear(props, year, selectedDate)` to customize the output of each rendering method.

```js
var MyDTPicker = React.createClass({
    render: function(){
        return <Datetime
            renderDay={ this.renderDay }
            renderMonth={ this.renderMonth }
            renderYear={ this.renderYear }
        />;
    },
    renderDay: function( props, currentDate, selectedDate ){
        return <td {...props}>{ '0' + currentDate.date() }</td>;
    },
    renderMonth: function( props, month, year, selectedDate ){
        return <td {...props}>{ month }</td>;
    },
    renderYear: function( props, year, selectedDate ){
        return <td {...props}>{ year % 100 }</td>;
    }
});
```
[You can see a customized calendar here.](http://codepen.io/simeg/pen/YppLmO)

#### Method Parameters
* `props` is the object that the datepicker has calculated for this object. It is convenient to use this object as the `props` for your custom component, since it knows how to handle the click event and its `className` attribute is used by the default styles.
* `selectedDate` and `currentDate` are [moment objects](http://momentjs.com) and can be used to change the output depending on the selected date, or the date for the current day.
* `month` and `year` are the numeric representation of the current month and year to be displayed. Notice that the possible `month` values range from `0` to `11`.

## Specify Available Units
You can filter out what you want the user to be able to pick by using `dateFormat` and `timeFormat`, e.g. to create a timepicker, yearpicker etc.

In this example the component is being used as a *timepicker* and can *only be used for selecting a time*.
```js
<Datetime dateFormat={false} />
```
[Working example of a timepicker here.](http://codepen.io/simeg/pen/mRQBrp)

In this example you can *only select a year and month*.
```js
<Datetime dateFormat="YYYY-MM" timeFormat={false} />
```
[Working example of only selecting year and month here.](http://codepen.io/simeg/pen/apQLdd)

## Selectable Dates
It is possible to disable dates in the calendar if the user are not allowed to select them, e.g. dates in the past. This is done using the prop `isValidDate`, which admits a function in the form `function(currentDate, selectedDate)` where both arguments are [moment objects](http://momentjs.com). The function shall return `true` for selectable dates, and `false` for disabled ones.

In the example below are *all dates before today* disabled.

```js
// Let's use the static moment reference in the Datetime component
var yesterday = Datetime.moment().subtract( 1, 'day' );
var valid = function( current ){
    return current.isAfter( yesterday );
};
<Datetime isValidDate={ valid } />
```
[Working example of disabled days here.](http://codepen.io/simeg/pen/XNNYJg)

It's also possible to disable *the weekends*, as shown in the example below.
```js
var valid = function( current ){
    return current.day() !== 0 && current.day() !== 6;
};
<Datetime isValidDate={ valid } />
```
[Working example of disabled weekends here.](http://codepen.io/simeg/pen/jVVKWq)

## Usage with TypeScript

This project includes typings for TypeScript versions 1.8 and 2.0. Additional typings are not
required.

Typings for 1.8 are found in `react-datetime.d.ts` and typings for 2.0 are found in `typings/index.d.ts`.

```js
import * as Datetime from 'react-datetime';

class MyDTPicker extends React.Component<MyDTPickerProps, MyDTPickerState> {
    render() JSX.Element {
        return <Datetime />;
    }
}
```

## Contributions
For information about how to contribute, see the [CONTRIBUTING](.github/CONTRIBUTING.md) file.

## Development
```sh
npm run dev
```
This will start a local `webpack-dev-server` based on `example/example.js` where most development can be done.

If you want to develop using the component inside a React application, we recommend that you use [react-datetime-playground](https://github.com/arqex/react-datetime-playground).

### [Changelog](CHANGELOG.md)

### [MIT Licensed](LICENSE.md)
