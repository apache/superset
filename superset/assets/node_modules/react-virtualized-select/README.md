# React Virtualized Select

![NPM version](https://img.shields.io/npm/v/react-virtualized-select.svg?style=flat)
![NPM license](https://img.shields.io/npm/l/react-virtualized-select.svg?style=flat)
![NPM total downloads](https://img.shields.io/npm/dt/react-virtualized-select.svg?style=flat)
![NPM monthly downloads](https://img.shields.io/npm/dm/react-virtualized-select.svg?style=flat)
[![PayPal donate button](https://img.shields.io/badge/paypal-donate-lightgray.svg?style=flat)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=5CVMYQKVPZC72)
[![Patreon donate button](https://img.shields.io/badge/patreon-donate%20once-lightgray.svg?style=flat)](https://www.patreon.com/user?u=2979769)

### Demos available here: http://bvaughn.github.io/react-virtualized-select/

![react-virtualized-select example](https://cloud.githubusercontent.com/assets/29597/14285960/46d733a6-fb02-11e5-884a-e349eb462704.gif)

## Getting started

Install `react-virtualized-select` using npm.

```shell
npm install react-virtualized-select --save
```

ES6, CommonJS, and UMD builds are available with each distribution.
For example:

```js
// Make sure to import default styles.
// This only needs to be done once; probably during bootstrapping process.
import 'react-select/dist/react-select.css'
import 'react-virtualized/styles.css'
import 'react-virtualized-select/styles.css'

// Then import the virtualized Select HOC
import VirtualizedSelect from 'react-virtualized-select'
```

Alternately you can load a global-friendly UMD build:

```html
<link rel="stylesheet" href="path-to-react-select/dist/react-select.css">
<link rel="stylesheet" href="path-to-react-virtualized/styles.css">
<link rel="stylesheet" href="path-to-react-virtualized-select/styles.css">

<script src="path-to-react-virtualized-select/dist/umd/react-virtualized-select.js"></script>
```

## Simple Example

_react-select-virtualized_ works just like _react-select_. You pass it an array of options, along with any other parameters supported by the [`Select` component](https://github.com/JedWatson/react-select/#usage). Here's a simple example:

```js
import React, { Component } from 'react'
import VirtualizedSelect from 'react-virtualized-select'

import 'react-select/dist/react-select.css'
import 'react-virtualized/styles.css'
import 'react-virtualized-select/styles.css'

class MySelect extends Component {
  constructor (props) {
    super(props)

    this.state = {}
  }

  render () {
    const options = [
      { label: "One", value: 1 },
      { label: "Two", value: 2 },
      { label: "Three", value: 3, disabled: true }
      // And so on...
    ]

    return (
      <VirtualizedSelect
        options={options}
        onChange={(selectValue) => this.setState({ selectValue })}
        value={this.state.selectValue}
      />
    )
  }
}
```

## React Virtualized Select Props

The additional parameters introduced by _react-select-virtualized_ are optional. They are:

| Property | Type | Description |
|:---|:---|:---|
| async | `PropTypes.bool` | Use `Select.Async` internally; if this property is specified then a [`loadOptions`](https://github.com/JedWatson/react-select#async-options-with-promises) method should also be used. |
| maxHeight | `PropTypes.number` | Max height of options menu; defaults to 200 pixels. |
| optionHeight | `PropTypes.number` or `PropTypes.func` | Option height (defaults to 35 pixels). Dynamic height can be supported via a function with the signature `({ option: Object }): number` |
| optionRenderer | `PropTypes.func` | Custom option renderer; (see below for signature). |
| selectComponent | `PropTypes.func` | Use a specific select HOC (eg `Select`, `Select.Creatable`, `Select.Async` or `Select.AsyncCreatable`); defaults to `Select` (or `Select.Async` if `async` flag is true). |

## Custom Option Renderer

You can override the built-in option renderer by specifying your own `optionRenderer` property. Your renderer should return a React element that represents the specified option. It will be passed the following named parameters:

| Property | Type | Description |
|:---|:---|:---|
| focusedOption | `Object` | The option currently-focused in the dropdown. Use this property to determine if your rendered option should be highlighted or styled differently. |
| focusedOptionIndex | `number` | Index of the currently-focused option. |
| focusOption | `Function` | Callback to update the focused option; for example, you may want to call this function on mouse-over. |
| key | `string` | A unique identifier for each element created by the renderer. |
| labelKey | `string` | Attribute of option that contains the display text. |
| option | `Object` | The option to be rendered. |
| options | `Array<Object>` | Array of options (objects) contained in the select menu. |
| selectValue | `Function` | Callback to update the selected values; for example, you may want to call this function on click. |
| style | `Object` | Styles that must be passed to the rendered option. These styles are specifying the position of each option (required for correct option displaying in the dropdown).
| valueArray | `Array<Object>` | Array of the currently-selected options. Use this property to determine if your rendered option should be highlighted or styled differently. |
| valueKey | `string` | Attribute of option that contains the value. |
