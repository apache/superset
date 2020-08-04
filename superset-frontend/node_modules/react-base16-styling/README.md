# react-base16-styling [![Build Status](https://img.shields.io/travis/alexkuz/react-base16-styling/master.svg)](https://travis-ci.org/alexkuz/react-base16-styling) [![Latest Stable Version](https://img.shields.io/npm/v/react-base16-styling.svg)](https://www.npmjs.com/package/react-base16-styling)

React styling with base16 color scheme support

Inspired by [react-themeable](https://github.com/markdalgleish/react-themeable), this utility provides flexible theming for your component with [base16](https://github.com/chriskempson/base16) theme support.

## Install

```
npm i -S react-base16-styling
```

## Usage

```jsx
import { createStyling } from 'react-base16-styling';
import base16Themes from './base16Themes';

function getStylingFromBase16(base16Theme) {
  return {
    myComponent: {
      backgroundColor: base16Theme.base00
    },

    myComponentToggleColor({ style, className }, clickCount) {
      return {
        style: {
          ...style,
          backgroundColor: clickCount % 2 ? 'red' : 'blue'
        }
      }
    }
  };
}

const createStylingFromTheme = createStyling(getStylingFromBase16, {
  defaultBase16: base16Themes.solarized,
  base16Themes
});

class MyComponent extends Component {
  state = { clickCount: 0 }
  render() {
    const { theme } = this.props;
    const { clickCount } = this.state;
    
    const styling = createStylingFromTheme(theme);
    
    return (
      <div {...styling('myComponent')}>
        <a onClick={() => this.setState({ clickCount: clickCount + 1 })}>Click Me</a>
        <div {...styling('myComponentToggleColor', clickCount)}>
          {clickCount}
        </div>
      </div>
    )
  }
}
```

## `createStyling`

```js
function(getStylingFromBase16, defaultStylingOptions, themeOrStyling)
```

Argument | Signature | Description
----|-----|-----
`getStylingFromBase16` | `function(base16Theme)` | creates object with default stylings for your component, using provided base16 theme.
`defaultStylingOptions` | `{ defaultBase16, base16Themes }` | optional parameters, allow to set default `base16` theme and additional `base16` themes for component.
`themeOrStyling` | `string` or `object` | `base16` theme name, `base16` theme object or styling object. Theme name can have a modifier: `"themeName:inverted"` to invert theme colors (see [[#invertTheme]])

Styling object values could be:
    - objects (treated as style definitions)
    - strings (class names)
    - functions (they may be provided with additional parameters and should return object { style, className })

## `getBase16Theme`
```js
function(themeOrStyling, base16Themes)
```

Helper method that returns `base16` theme object if `themeOrStyling` is `base16` theme name or theme object.

## `invertTheme`
```js
function(theme)
```

Helper method that inverts `base16` theme colors, creating light theme out of dark one or vice versa.
