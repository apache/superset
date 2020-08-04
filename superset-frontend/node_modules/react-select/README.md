[![NPM](https://img.shields.io/npm/v/react-select.svg)](https://www.npmjs.com/package/react-select)
[![CircleCI](https://circleci.com/gh/JedWatson/react-select/tree/master.svg?style=shield)](https://circleci.com/gh/JedWatson/react-select/tree/master)
[![Coverage Status](https://coveralls.io/repos/JedWatson/react-select/badge.svg?branch=master&service=github)](https://coveralls.io/github/JedWatson/react-select?branch=master)
[![Supported by Thinkmill](https://thinkmill.github.io/badge/heart.svg)](http://thinkmill.com.au/?utm_source=github&utm_medium=badge&utm_campaign=react-select)

# React-Select

The Select control for [React](https://reactjs.com). Initially built for use in [KeystoneJS](http://www.keystonejs.com).

See [react-select.com](https://www.react-select.com) for live demos and comprehensive docs.

See our [upgrade guide](https://github.com/JedWatson/react-select/issues/3585) for a breakdown on how to upgrade from v2 to v3.

React Select is funded by [Thinkmill](https://www.thinkmill.com.au) and [Atlassian](https://atlaskit.atlassian.com). It represents a whole new approach to developing powerful React.js components that _just work_ out of the box, while being extremely customisable.

Features include:

- Flexible approach to data, with customisable functions
- Extensible styling API with [emotion](https://emotion.sh)
- Component Injection API for complete control over the UI behaviour
- Controllable state props and modular architecture
- Long-requested features like option groups, portal support, animation, and more

If you're interested in the background, watch Jed's [talk on React Select](https://youtu.be/Eb2wy-HNGMo) at ReactNYC in March 2018.

See our [upgrade guide](https://react-select.com/upgrade-guide) for a breakdown on how to upgrade from v1 to v2.

The old docs and examples will continue to be available at [v1.react-select.com](https://v1.react-select.com).

# Installation and usage

The easiest way to use react-select is to install it from npm and build it into your app with Webpack.

```
yarn add react-select
```

Then use it in your app:

```js
import React from 'react';
import Select from 'react-select';

const options = [
  { value: 'chocolate', label: 'Chocolate' },
  { value: 'strawberry', label: 'Strawberry' },
  { value: 'vanilla', label: 'Vanilla' },
];

class App extends React.Component {
  state = {
    selectedOption: null,
  };
  handleChange = selectedOption => {
    this.setState({ selectedOption });
    console.log(`Option selected:`, selectedOption);
  };
  render() {
    const { selectedOption } = this.state;

    return (
      <Select
        value={selectedOption}
        onChange={this.handleChange}
        options={options}
      />
    );
  }
}
```

## Props

Common props you may want to specify include:

- `autoFocus` - focus the control when it mounts
- `className` - apply a className to the control
- `classNamePrefix` - apply classNames to inner elements with the given prefix
- `isDisabled` - disable the control
- `isMulti` - allow the user to select multiple values
- `isSearchable` - allow the user to search for matching options
- `name` - generate an HTML input with this name, containing the current value
- `onChange` - subscribe to change events
- `options` - specify the options the user can select from
- `placeholder` - change the text displayed when no option is selected
- `value` - control the current value

See the [props documentation](https://www.react-select.com/props) for complete documentation on the props react-select supports.

## Controllable Props

You can control the following props by providing values for them. If you don't, react-select will manage them for you.

- `value` / `onChange` - specify the current value of the control
- `menuIsOpen` / `onMenuOpen` / `onMenuClose` - control whether the menu is open
- `inputValue` / `onInputChange` - control the value of the search input (changing this will update the available options)

If you don't provide these props, you can set the initial value of the state they control:

- `defaultValue` - set the initial value of the control
- `defaultMenuIsOpen` - set the initial open value of the menu
- `defaultInputValue` - set the initial value of the search input

## Methods

React-select exposes two public methods:

- `focus()` - focus the control programatically
- `blur()` - blur the control programatically

## Customisation

Check the docs for more information on:

- [Customising the styles](https://www.react-select.com/styles)
- [Using custom components](https://www.react-select.com/components)
- [Using the built-in animated components](https://www.react-select.com/home#animated-components)
- [Creating an async select](https://www.react-select.com/async)
- [Allowing users to create new options](https://www.react-select.com/creatable)
- [Advanced use-cases](https://www.react-select.com/advanced)

# Thanks

Thank you to everyone who has contributed to this project. It's been a wild ride.

If you like React Select, you should [follow me on twitter](https://twitter.com/jedwatson)

Shout out to [Joss Mackison](https://github.com/jossmac), [Charles Lee](https://github.com/gwyneplaine), [Ben Conolly](https://github.com/Noviny), [Dave Brotherstone](https://github.com/bruderstein), [Brian Vaughn](https://github.com/bvaughn), and the Atlassian Design System team ❤️

## License

MIT Licensed. Copyright (c) Jed Watson 2019.
