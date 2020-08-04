Changelog
=========
## 2.16.2
* Turns moment timezone peer dependency in a runtime error when missing using `displayTimezone`.

## 2.16.1
* Fixes input event overriding

## 2.16.0
* The prop `disableOnClickOutside` has been renamed to `disableCloseOnClickOutside`
* The calendar doesn't get closed an open when clicking in the input anymore.
* Fixes errors not finding dates when customizing day rendering.
* Event listeners in `inputProps` now only override default behaviour when returning `false`.
* Adds the `displayTimeZone` prop. Thanks to @martingordon

## 2.15.0
* New `onNavigateBack` and `onNavigateForward` hooks thanks to @DaanDD and @simeg.
* Touch improvements by @NicoDos
* TS and debugging improvements

## 2.14.0
* Make `viewDate` dynamic

## 2.13.0
* Use more appropriate cursor for empty space in time picker and in day texts
* Add `viewDate` prop that sets a value when opening the calendar when there is no selected date
* Make `disableOnClickOutside` work as intended
* Better touch support for tapping and holding
* Use static property `defaultProps` instead of `getDefaultProps`

## 2.12.0
* The `renderInput` prop now receives `closeCalendar` function as well

## 2.11.1
* The open prop should now work as intended

## 2.11.0
* onFocus now receives the browser event
* Do not open browser menu on right click of arrows in time view
* Open calendar when onClick is triggered, before it would just react to onFocus
* Update TypeScript definitions for value and defaultValue to comply with code
* Fix bug where AM/PM would not sync between component value and input field value
* Add renderInput prop which let's the consumer of the component render their own HTML input element

## 2.10.3
* Update react-onclickoutside dependency
* Remove isValidDate check before rendering as implementation was causing crashes in some edge cases.

## 2.10.2
* Move @types/react back to devDependencies
* Add [demo](https://youcanbookme.github.io/react-datetime) app.

## 2.10.1
* Fix build files.

## 2.10.0
* Add isValidDate check before rendering so it doesn't render with an invalid date.

## 2.9.0
* Trigger callback method on view mode changes

## 2.8.11
* Update TypeScript definitions
* Replace deprecated React method with non-deprecated method

## 2.8.10
* Increase click area of arrows for changing day/month/year
* Update code according to React 15.5.0
  * Remove usage of React.createClass
  * Use separate module for PropTypes

## 2.8.9
* Fixes issue where incorrect current month is shown

## 2.8.8
* Fixes issues introduced in v2.8.7 recognizing any calendar view as clickingOutside trigger

## 2.8.7
* Update react-onclickoutside dependency. That should fix most of the problems about closeOnSelect.

## 2.8.6
* Revert commits related to `closeOnSelect` that did not fix all issues they were meant to

## 2.8.5
* Fix bug where `closeOnSelect` was not closing when it was set to `true`
* Fix bug where component would not immediately re-render when updating either `utc` or `locale` prop

## 2.8.4
* Fix bug where `closeOnSelect=true` would cause component to close on state change

## 2.8.3
* Fix `isValidDate` related bug where current month would be invalid
* Trigger re-render of component when `viewMode` changes
* Never append `rdtOld` class in year view

## 2.8.2
* Fix year related bug in tests where year was set to 2016
* Add a yarnfile so yarn is now possible to use for installing dependencies

## 2.8.1
* Fix timeFormat related bug where 'A' was being picked up but not 'a', for setting 12-hour clock.

## 2.8.0
* Add typings for TypeScript 2.0. We now support TypeScript typings for versions 1.8 and 2.0.

## 2.7.5
* Bumps the version to skip buggy deployment 2.7.4

## 2.7.4
* Reverting updating `react` related dependencies. They were not the issue so they should not be set to the latest version of `react`.

## 2.7.3
* When updating `moment` to `2.16.0` something broke, hopefully by updating all `react` prefixed dependencies to `15.4.0` and changing the syntax in the dependency object a bit will resolve this issue.

## 2.7.2
* Bug fix: When setting `locale` and entering month view mode the component would sometimes freeze, depending on the locale. This has now been fixed.

## 2.7.1
* Bug fix: `onFocus` and `onBlur` were being called in a way causing state to reset. This unwanted behavior is now adjusted.

## 2.7.0
* `isValidDate` now supports months and years.
* `utc` prop was added, by setting it to `true` input time values will be interpreted as UTC (Zulu time).
* Bug fix: The input value now updates when `dateFormat` changes.
* Removed the source-map file because the commit it was introduced in was causing the minified file to be bigger than the non-minified.

## 2.6.2
* Update file references in `package.json`

## 2.6.1
* Added a source-map file.
* Fixed bug with invalid moment object.
* Decreased npm package size by ~29.3KB.

## 2.6.0
* Fixed hover styles for days
* Added multiple simultaneous datetime component support.
* `className` prop now supports string arrays
* Fixes 12:00am
* Removed warning for missing element keys.

## 2.5.0
* Added pre-commit hook for tests.
* Added the `timeConstraints` prop.

## 2.4.0
* Added ES linting.
* Added `closeOnTab` property.

## 2.3.3
* Updated readme.
* Fixed short months for not English locales.
* Fixed mixed 12 AM/PM.

## 2.3.2
* Time editor now handles the A format to display 12h times.

## 2.3.0
* Added typescript definition file.
* Changed button markup and updated styles.
* Fixes autoclosing on time change.

## 2.2.1
* Controlled datepicker now working for controlled datepickers

## 2.2.0
* The picker can be used as a month or year picker just giving a format date without days/months
* Updates test suite

## 2.1.0
* Fixed rdtActive not getting set.
* Add react-dom as external dependency.
* Fixed rendering a span directly under the calendar table.
* Added dev setup
* Added example

## 2.0.2
* Fixed january days go to november problem.

## 2.0.1
* Fixed two days can't have the same header name.

## 2.0.0
* DOM classes are now prefixed with `rdt`.
* A modified version of OnClickOutside is now included in the code to handle react 0.13 and 0.14 versions.
* Updated dependencies.

## 1.3.0
* Added open prop.
* Added strictParsing prop.
* Fixed not possible to set value to `''`.

## 1.2.1
* Removed classlist-polyfill so the component can be used in the server side.

## 1.1.1
* Updates react-onclickoutside dependency to avoid the bug https://github.com/Pomax/react-onclickoutside/issues/20

## 1.1.0
* Datepicker can have an empty value. If the value in the input is not valid, `onChange` and `onBlur` will return input value.
* `onBlur` is not triggered anymore if the calendar is not open.

## 1.0.0-rc.2
* Added travis CI
* Fixed not showing timepicker when `dateFormat`=`false`.

## 1.0.0-rc.1
This is the release candidate for this project. Now it is pretty usable and API won't change drastically in a while. If you were using the alpha versions (v0.x) there is a bunch of breaking changes:

* `date` prop is now called `defaultValue` and it is the initial value to use the component uncontrolled.
* `value` prop has been added to use it as a [controlled component](https://facebook.github.io/react/docs/forms.html#controlled-components).
* Removed `minDate` and `maxDate` props. Now to define what dates are valid it is possible to use the new `isValidDate` prop.
* `dateFormat` and `timeFormat` default value is always the locale default format. In case that you don't want the component to show the date/time picker you should set `dateFormat`/`timeFormat` to `false`.

Moreover:
* Buttons doesn't submit anymore when the Datetime component is in a form.
* `className` prop has been added to customize component class.
