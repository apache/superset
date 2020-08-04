[![NPM](https://img.shields.io/npm/v/react-select.svg)](https://www.npmjs.com/package/react-select)
[![CDNJS](https://img.shields.io/cdnjs/v/react-select.svg)](https://cdnjs.com/libraries/react-select)
[![Build Status](https://travis-ci.org/JedWatson/react-select.svg?branch=master)](https://travis-ci.org/JedWatson/react-select)
[![Coverage Status](https://coveralls.io/repos/JedWatson/react-select/badge.svg?branch=master&service=github)](https://coveralls.io/github/JedWatson/react-select?branch=master)
[![Supported by Thinkmill](https://thinkmill.github.io/badge/heart.svg)](http://thinkmill.com.au/?utm_source=github&utm_medium=badge&utm_campaign=react-select)

React-Select
============

A Select control built with and for [React](http://facebook.github.io/react/index.html). Initially built for use in [KeystoneJS](http://www.keystonejs.com).

---

## v2.0.0 Beta

A major update to React-select is coming! v2 is all new with some major API improvements, a powerful
new styles and components API, and support for some long-requested features like option groups.

To install the new version:

```
yarn add react-select@next
```

Check out the [v2 documentation](https://deploy-preview-2289--react-select.netlify.com)
and [upgrade guide](https://deploy-preview-2289--react-select.netlify.com/upgrade-guide).

---


## Demo & Examples

Live demo: [jedwatson.github.io/react-select](http://jedwatson.github.io/react-select/)


## Installation

The easiest way to use react-select is to install it from npm and build it into your app with Webpack.

```
yarn add react-select
```

You can then import react-select and its styles in your application as follows:

```js
import Select from 'react-select';
import 'react-select/dist/react-select.css';
```

You can also use the standalone UMD build by including `dist/react-select.js` and `dist/react-select.css` in your page. If you do this you'll also need to include the dependencies. For example:

```html
<script src="https://unpkg.com/react@15.6.1/dist/react.js"></script>
<script src="https://unpkg.com/react-dom@15.6.1/dist/react-dom.js"></script>
<script src="https://unpkg.com/prop-types@15.5.10/prop-types.js"></script>
<script src="https://unpkg.com/classnames@2.2.5/index.js"></script>
<script src="https://unpkg.com/react-input-autosize@2.0.0/dist/react-input-autosize.js"></script>
<script src="https://unpkg.com/react-select@1.2.1/dist/react-select.js"></script>

<link rel="stylesheet" href="https://unpkg.com/react-select@1.2.1/dist/react-select.css">
```


## Usage

React-Select generates a hidden text field containing the selected value, so you can submit it as part of a standard form. You can also listen for changes with the `onChange` event property.

Options should be provided as an `Array` of `Object`s, each with a `value` and `label` property for rendering and searching. You can use a `disabled` property to indicate whether the option is disabled or not.

The `value` property of each option should be either a string or a number.

When the value is changed, `onChange(selectedValueOrValues)` will fire. Note that (as of 1.0) you **must** handle the change and pass the updated `value` to the Select.

```js
import React from 'react';
import Select from 'react-select';

class App extends React.Component {
  state = {
    selectedOption: '',
  }
  handleChange = (selectedOption) => {
    this.setState({ selectedOption });
    // selectedOption can be null when the `x` (close) button is clicked
    if (selectedOption) {
      console.log(`Selected: ${selectedOption.label}`);
    }
  }
  render() {
    const { selectedOption } = this.state;

    return (
      <Select
        name="form-field-name"
        value={selectedOption}
        onChange={this.handleChange}
        options={[
          { value: 'one', label: 'One' },
          { value: 'two', label: 'Two' },
        ]}
      />
    );
  }
}
```

You can customise the `valueKey` and `labelKey` props to use a different option shape.

### Custom classNames

You can provide a custom `className` prop to the `<Select>` component, which will be added to the base `.Select` className for the outer container.

The built-in Options renderer also support custom classNames, just add a `className` property to objects in the `options` array.

### Multiselect options

You can enable multi-value selection by setting `multi={true}`. In this mode:

* Selected options will be removed from the dropdown menu by default. If you want them to remain in the list, set `removeSelected={false}`
* The selected values are submitted in multiple `<input type="hidden">` fields, use the `joinValues` prop to submit joined values in a single field instead
* The values of the selected items are joined using the `delimiter` prop to create the input value when `joinValues` is true
* A simple value, if provided, will be split using the `delimiter` prop
* The `onChange` event provides an array of selected options _or_ a comma-separated string of values (eg `"1,2,3"`) if `simpleValue` is true
* By default, only options in the `options` array can be selected. Use the `Creatable` Component (which wraps `Select`) to allow new options to be created if they do not already exist. Hitting comma (','), ENTER or TAB will add a new option. Versions `0.9.x` and below provided a boolean attribute on the `Select` Component (`allowCreate`) to achieve the same functionality. It is no longer available starting with version `1.0.0`.
* By default, selected options can be cleared. To disable the possibility of clearing a particular option, add `clearableValue: false` to that option:
```js
var options = [
  { value: 'one', label: 'One' },
  { value: 'two', label: 'Two', clearableValue: false }
];
```
Note: the `clearable` prop of the Select component should also be set to `false` to prevent allowing clearing all fields at once

#### Accessibility Note

Selected values aren't focus targets, which means keyboard users can't tab to them, and are restricted to removing them using backspace in order. This isn't ideal and I'm looking at other options for the future; in the meantime if you want to use a custom `valueComponent` that implements tabIndex and keyboard event handling, see #2098 for an example.

### Async options

If you want to load options asynchronously, use the `Async` export and provide a `loadOptions` Function.

The function takes two arguments `String input, Function callback`and will be called when the input text is changed.

When your async process finishes getting the options, pass them to `callback(err, data)` in a Object `{ options: [] }`.

The select control will intelligently cache options for input strings that have already been fetched. The cached result set will be filtered as more specific searches are input, so if your async process would only return a smaller set of results for a more specific query, also pass `complete: true` in the callback object. Caching can be disabled by setting `cache` to `false` (Note that `complete: true` will then have no effect).

Unless you specify the property `autoload={false}` the control will automatically load the default set of options (i.e. for `input: ''`) when it is mounted.

```js
import { Async } from 'react-select';

const getOptions = (input, callback) => {
  setTimeout(() => {
    callback(null, {
      options: [
        { value: 'one', label: 'One' },
        { value: 'two', label: 'Two' }
      ],
      // CAREFUL! Only set this to true when there are no more options,
      // or more specific queries will not be sent to the server.
      complete: true
    });
  }, 500);
};

<Async
  name="form-field-name"
  loadOptions={getOptions}
/>
```

#### Note about filtering async options

The `Async` component doesn't change the default behaviour for filtering the options based on user input, but if you're already filtering the options server-side you may want to customise or disable this feature (see [filtering options](#filtering-options) below). For example, if you would like to completely disable client side filtering, you can do so with:

```js
filterOptions={(options, filter, currentValues) => {
  // Do no filtering, just return all options
  return options;
}}
```

### Async options with Promises

`loadOptions` supports Promises, which can be used in very much the same way as callbacks.

Everything that applies to `loadOptions` with callbacks still applies to the Promises approach (e.g. caching, autoload, ...)

An example using the `fetch` API and ES6 syntax, with an API that returns an object like:

```js
import { Async } from 'react-select';

/*
 * assuming the API returns something like this:
 *   const json = [
 *      { value: 'one', label: 'One' },
 *      { value: 'two', label: 'Two' }
 *   ]
 */

const getOptions = (input) => {
  return fetch(`/users/${input}.json`)
    .then((response) => {
      return response.json();
    }).then((json) => {
      return { options: json };
    });
}

<Async
  name="form-field-name"
  value="one"
  loadOptions={getOptions}
/>
```

### Async options loaded externally

If you want to load options asynchronously externally from the `Select` component, you can have the `Select` component show a loading spinner by passing in the `isLoading` prop set to `true`.

```js
import Select from 'react-select';

let isLoadingExternally = true;

<Select
  name="form-field-name"
  isLoading={isLoadingExternally}
  ...
/>
```

### User-created tags

The `Creatable` component enables users to create new tags within react-select.
It decorates a `Select` and so it supports all of the default properties (eg single/multi mode, filtering, etc) in addition to a couple of custom ones (shown below).
The easiest way to use it is like so:

```js
import { Creatable } from 'react-select';

function render (selectProps) {
  return <Creatable {...selectProps} />;
};
```

### Combining Async and Creatable

Use the `AsyncCreatable` HOC if you want both _async_ and _creatable_ functionality.
It ties `Async` and `Creatable` components together and supports a union of their properties (listed above).
Use it as follows:

```js
import { AsyncCreatable } from 'react-select';

function render (props) {
  // props can be a mix of Async, Creatable, and Select properties
  return (
    <AsyncCreatable {...props} />
  );
}
```

### Filtering options

You can control how options are filtered with the following props:

* `matchPos`: `"start"` or `"any"`: whether to match the text entered at the start or any position in the option value
* `matchProp`: `"label"`, `"value"` or `"any"`: whether to match the value, label or both values of each option when filtering
* `ignoreCase`: `Boolean`: whether to ignore case or match the text exactly when filtering
* `ignoreAccents`: `Boolean`: whether to ignore accents on characters like ø or å

`matchProp` and `matchPos` both default to `"any"`.
`ignoreCase` defaults to `true`.
`ignoreAccents` defaults to `true`.

#### Advanced filters

You can also completely replace the method used to filter either a single option, or the entire options array (allowing custom sort mechanisms, etc.)

* `filterOption`: `function(Object option, String filter)` returns `Boolean`. Will override `matchPos`, `matchProp`, `ignoreCase` and `ignoreAccents` options.
* `filterOptions`: `function(Array options, String filter, Array currentValues)` returns `Array filteredOptions`. Will override `filterOption`, `matchPos`, `matchProp`, `ignoreCase` and `ignoreAccents` options.

For multi-select inputs, when providing a custom `filterOptions` method, remember to exclude current values from the returned array of options.

#### Filtering large lists

The default `filterOptions` method scans the options array for matches each time the filter text changes.
This works well but can get slow as the options array grows to several hundred objects.
For larger options lists a custom filter function like [`react-select-fast-filter-options`](https://github.com/bvaughn/react-select-fast-filter-options) will produce better results.

### Efficiently rendering large lists with windowing

The `menuRenderer` property can be used to override the default drop-down list of options.
This should be done when the list is large (hundreds or thousands of items) for faster rendering.
Windowing libraries like [`react-virtualized`](https://github.com/bvaughn/react-virtualized) can then be used to more efficiently render the drop-down menu like so.
The easiest way to do this is with the [`react-virtualized-select`](https://github.com/bvaughn/react-virtualized-select/) HOC.
This component decorates a `Select` and uses the react-virtualized `VirtualScroll` component to render options.
Demo and documentation for this component are available [here](https://bvaughn.github.io/react-virtualized-select/).

You can also specify your own custom renderer.
The custom `menuRenderer` property accepts the following named parameters:

| Parameter | Type | Description |
|:---|:---|:---|
| focusedOption | `Object` | The currently focused option; should be visible in the menu by default. |
| focusOption | `Function` | Callback to focus a new option; receives the option as a parameter. |
| labelKey | `String` | Option labels are accessible with this string key. |
| optionClassName | `String` | The className that gets used for options |
| optionComponent | `ReactClass` | The react component that gets used for rendering an option |
| optionRenderer | `Function` | The function that gets used to render the content of an option |
| options | `Array<Object>` | Ordered array of options to render. |
| selectValue | `Function` | Callback to select a new option; receives the option as a parameter. |
| valueArray | `Array<Object>` | Array of currently selected options. |

### Updating input values with onInputChange

You can manipulate the input by providing a `onInputChange` callback that returns a new value.
**Please note:** When you want to use `onInputChange` only to listen to the input updates, you still have to return the unchanged value!

```js
function cleanInput(inputValue) {
  // Strip all non-number characters from the input
  return inputValue.replace(/[^0-9]/g, "");
}

<Select
  name="form-field-name"
  onInputChange={cleanInput}
/>
```

### Overriding default key-down behaviour with onInputKeyDown

`Select` listens to `keyDown` events to select items, navigate drop-down list via arrow keys, etc.
You can extend or override this behaviour by providing a `onInputKeyDown` callback.

```js
function onInputKeyDown(event) {
  switch (event.keyCode) {
    case 9: // TAB
      // Extend default TAB behaviour by doing something here
      break;
    case 13: // ENTER
      // Override default ENTER behaviour by doing stuff here and then preventing default
      event.preventDefault();
      break;
  }
}

<Select
  {...otherProps}
  onInputKeyDown={onInputKeyDown}
/>
```

### Select Props

| Property | Type | Default | Description |
|:---|:---|:---|:---|
| `aria`-describedby | string | undefined | HTML ID(s) of element(s) that should be used to describe this input (for assistive tech) |
| `aria`-label | string | undefined | Aria label (for assistive tech) |
| `aria`-labelledby | string | undefined | HTML ID of an element that should be used as the label (for assistive tech) |
| `arrowRenderer` | function | undefined | Renders a custom drop-down arrow to be shown in the right-hand side of the select: `arrowRenderer({ onMouseDown, isOpen })`. Won't render when set to `null`
| `autoBlur` | boolean | false | Blurs the input element after a selection has been made. Handy for lowering the keyboard on mobile devices |
| `autofocus` | boolean | undefined | deprecated; use the autoFocus prop instead |
| `autoFocus` | boolean | undefined | autofocus the component on mount |
| `autoload` | boolean | true | whether to auto-load the default async options set |
| `autosize` | boolean | true | If enabled, the input will expand as the length of its value increases |
| `backspaceRemoves` | boolean | true | whether pressing backspace removes the last item when there is no input value (Also see related prop `deleteRemoves`) |
| `backspaceToRemoveMessage` | string | 'Press backspace to remove {last label}' | prompt shown in input when at least one option in a multiselect is shown, set to '' to clear |
| `className` | string | undefined | className for the outer element |
| `clearable` | boolean | true | should it be possible to reset value |
| `clearAllText` | string | 'Clear all' | title for the "clear" control when `multi` is true |
| `clearRenderer` | function | undefined | Renders a custom clear to be shown in the right-hand side of the select when clearable true: `clearRenderer()` |
| `clearValueText` | string | 'Clear value' | title for the "clear" control |
| `closeOnSelect` | boolean | true | whether to close the menu when a value is selected
| `deleteRemoves` | boolean | true | whether pressing delete key removes the last item when there is no input value.  (Also see related prop `backspaceRemoves`) |
| `delimiter` | string | ',' | delimiter to use to join multiple values |
| `disabled` | boolean | false | whether the Select is disabled or not |
| `escapeClearsValue` | boolean | true | whether escape clears the value when the menu is closed |
| `filterOption` | function | undefined | method to filter a single option `(option, filterString) => boolean` |
| `filterOptions` | boolean or function | undefined | boolean to enable default filtering or function to filter the options array `([options], filterString, [values]) => [options]` |
| `id` | string | undefined | html id to set on the input element for accessibility or tests
| `ignoreAccents` | boolean | true | whether to strip accents when filtering |
| `ignoreCase` | boolean | true | whether to perform case-insensitive filtering |
| `inputProps` | object | undefined | custom attributes for the Input (in the Select-control) e.g: `{'data-foo': 'bar'}` |
| `inputRenderer` | function | undefined | renders a custom input component |
| `instanceId` | string | increment | instance ID used internally to set html ids on elements for accessibility, specify for universal rendering |
| `isLoading` | boolean | false | whether the Select is loading externally or not (such as options being loaded) |
| `joinValues` | boolean | false | join multiple values into a single hidden input using the `delimiter` |
| `labelKey` | string | 'label' | the option property to use for the label |
| `matchPos` | string | 'any' | (any, start) match the start or entire string when filtering |
| `matchProp` | string | 'any' | (any, label, value) which option property to filter on |
| `menuBuffer` | number | 0 | buffer of px between the base of the dropdown and the viewport to shift if menu doesnt fit in viewport |
| `menuContainerStyle` | object | undefined | optional style to apply to the menu container |
| `menuRenderer` | function | undefined | Renders a custom menu with options; accepts the following named parameters: `menuRenderer({ focusedOption, focusOption, options, selectValue, valueArray })` |
| `menuStyle` | object | undefined | optional style to apply to the menu |
| `multi` | boolean | undefined | multi-value input |
| `name` | string | undefined | field name, for hidden `<input />` tag |
| `noResultsText` | string | 'No results found' | placeholder displayed when there are no matching search results or a falsy value to hide it (can also be a react component) |
| `onBlur` | function | undefined | onBlur handler: `function(event) {}` |
| `onBlurResetsInput` | boolean | true | Whether to clear input on blur or not. If set to false, it only works if onCloseResetsInput is false as well. |
| `onChange` | function | undefined | onChange handler: `function(newOption) {}` |
| `onClose` | function | undefined | handler for when the menu closes: `function () {}` |
| `onCloseResetsInput` | boolean | true | whether to clear input when closing the menu through the arrow |
| `onFocus` | function | undefined | onFocus handler: `function(event) {}` |
| `onInputChange` | function | undefined | onInputChange handler/interceptor: `function(inputValue: string): string` |
| `onInputKeyDown` | function | undefined | input keyDown handler; call `event.preventDefault()` to override default `Select` behaviour: `function(event) {}` |
| `onMenuScrollToBottom` | function | undefined | called when the menu is scrolled to the bottom |
| `onOpen` | function | undefined | handler for when the menu opens: `function () {}` |
| `onSelectResetsInput` | boolean | true | whether the input value should be reset when options are selected. Also input value will be set to empty if 'onSelectResetsInput=true' and Select will get new value that not equal previous value. |
| `onValueClick` | function | undefined | onClick handler for value labels: `function (value, event) {}` |
| `openOnClick` | boolean | true | open the options menu when the control is clicked (requires searchable = true) |
| `openOnFocus` | boolean | false | open the options menu when the control gets focus |
| `optionClassName` | string | undefined | additional class(es) to apply to the <Option /> elements |
| `optionComponent` | function | undefined | option component to render in dropdown |
| `optionRenderer` | function | undefined | custom function to render the options in the menu |
| `options` | array | undefined | array of options |
| `removeSelected` | boolean | true | whether the selected option is removed from the dropdown on multi selects |
| `pageSize` | number | 5 | number of options to jump when using page up/down keys |
| `placeholder` | string or node | 'Select ...' | field placeholder, displayed when there's no value |
| `required` | boolean | false | applies HTML5 required attribute when needed |
| `resetValue` | any | null | value to set when the control is cleared |
| `rtl` | boolean | false | use react-select in right-to-left direction |
| `scrollMenuIntoView` | boolean | true | whether the viewport will shift to display the entire menu when engaged |
| `searchable` | boolean | true | whether to enable searching feature or not |
| `searchPromptText` | string or node | 'Type to search' | label to prompt for search input |
| `simpleValue` | boolean | false | pass the value to onChange as a string |
| `style` | object | undefined | optional styles to apply to the control |
| `tabIndex` | string or number | undefined | tabIndex of the control |
| `tabSelectsValue` | boolean | true | whether to select the currently focused value when the `[tab]` key is pressed |
| `trimFilter` | boolean | true | whether to trim whitespace from the filter value |
| `value` | any | undefined | initial field value |
| `valueComponent` | function | <Value /> | function which returns a custom way to render/manage the value selected `<CustomValue />` |
| `valueKey` | string | 'value' | the option property to use for the value |
| `valueRenderer` | function | undefined | function which returns a custom way to render the value selected `function (option) {}` |
| `wrapperStyle` | object | undefined | optional styles to apply to the component wrapper |

#### Async Props

| Property | Type | Default | Description |
|:---|:---|:---|:---|
| `autoload` | boolean | true | automatically call the `loadOptions` prop on-mount |
| `cache` | object | undefined | Sets the cache object used for options. Set to `false` if you would like to disable caching.
| `loadingPlaceholder` | string or node | 'Loading...' | label to prompt for loading search result |
| `loadOptions` | function | undefined | function that returns a promise or calls a callback with the options: `function(input, [callback])` |

#### Creatable properties

| Property | Type | Description |
:---|:---|:---|
| `children` | function | Child function responsible for creating the inner Select component. This component can be used to compose HOCs (eg Creatable and Async). Expected signature: `(props: Object): PropTypes.element` |
| `isOptionUnique` | function | Searches for any matching option within the set of options. This function prevents duplicate options from being created. By default this is a basic, case-sensitive comparison of label and value. Expected signature: `({ option: Object, options: Array, labelKey: string, valueKey: string }): boolean` |
| `isValidNewOption` | function | Determines if the current input text represents a valid option. By default any non-empty string will be considered valid. Expected signature: `({ label: string }): boolean` |
| `newOptionCreator` | function | Factory to create new option. Expected signature: `({ label: string, labelKey: string, valueKey: string }): Object` |
| `onNewOptionClick` | function | new option click handler, it calls when new option has been selected. `function(option) {}` |
| `shouldKeyDownEventCreateNewOption` | function | Decides if a keyDown event (eg its `keyCode`) should result in the creation of a new option. ENTER, TAB and comma keys create new options by default. Expected signature: `({ keyCode: number }): boolean` |
| `promptTextCreator` | function | Factory for overriding default option creator prompt label. By default it will read 'Create option "{label}"'. Expected signature: `(label: String): String` |
| `showNewOptionAtTop` | boolean | `true`: (Default) Show new option at top of list <br> `false`: Show new option at bottom of list |

### Methods

Use the `focus()` method to give the control focus. All other methods on `<Select>` elements should be considered private.

```js
// focuses the input element
<instance>.focus();
```

# Contributing

See our [CONTRIBUTING.md](https://github.com/JedWatson/react-select/blob/master/CONTRIBUTING.md) for information on how to contribute.

Thanks to the projects this was inspired by: [Selectize](http://selectize.github.io/selectize.js/) (in terms of behaviour and user experience), [React-Autocomplete](https://github.com/rackt/react-autocomplete) (as a quality React Combobox implementation), as well as other select controls including [Chosen](http://harvesthq.github.io/chosen/) and [Select2](http://ivaynberg.github.io/select2/).


# License

MIT Licensed. Copyright (c) Jed Watson 2018.
