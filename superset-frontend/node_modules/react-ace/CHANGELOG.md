# Changelog

## Future Release - TBD

* Fully move to TypeScript interally
* Publish typings for the split editor
## 5.9.0

* First value resets undo manager. Closes #339 and #223
* Updated split editor documentation

## 5.8.0

* Upgrade brace to 0.11
* More loose comparison for componentDidMount for default value. Closes #317. Thanks @VijayKrish93

## 5.7.0

* Adds debounce option for onChange event
* Add support onCursorChange event
* Adds editor as second argument to the onBlur

## 5.5.0

* Adds the onInput event

## 5.4.0

* #285: Added the possibility to change key bindings of existing commands. thanks to @FurcyPin

## 5.3.0

* Adds support for React 16 thanks to @layershifter
* Removes react and react-dom from build. thanks to @M-ZubairAhmed

## 5.2.1 and 5.2.2

* Remove Open Collective from build

## 5.2.0

* Add support for events in onBlur and onFocus callbacks
* Adds onValidate callback

## 5.1.2

* Resize on component did mount and component did update. Fixes #207 and #212.

## 5.1.1

* Fix TypeScript definitions for EditorProps

## 5.1.0

* Editor options do not get reverted due to default props #226
* Markers can be unset to an empty value #229
* Typescript update to set state to empty object instead of undefined


## 5.0.1

* Fixes file extension issue related to `5.0.0`.

## 5.0.0

* Support for a Split View Editor - see more about the Split View editor [here](https://github.com/securingsincity/react-ace/blob/master/docs/Split.md)
* Ace Editor will now warn on mispelled editor options
* All new documentation

## 4.4.0

* Ace's resize method will be called when the prop `width` changes

## 4.3.0

* Adds support for `onSelectionChange` event
* Add the `Event` as an optional argument to the `onChange` prop
* All new examples

## 4.2.2

* [bugfix] should not handle markers without any markers

## 4.2.1

* Use `prop-type` package instead of React.PropType

## 4.2.0

* Fix `ref` related error

## 4.1.6

* Reverse `PureComponent` use in AceEditor back to `Component`

## 4.1.5

* Add ability to set `scrollMargins`

## 4.1.4

* TypeScript Definitions
