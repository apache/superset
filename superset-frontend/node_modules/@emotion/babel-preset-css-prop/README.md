# @emotion/babel-preset-css-prop

> A babel preset to automatically enable emotion's css prop

- [Install](#install)
- [Usage](#usage)
- [Features](#features)
- [Options](#options)

## Install

```bash
yarn add @emotion/babel-preset-css-prop
```

## Usage

**.babelrc**

```json
{
  "presets": ["@emotion/babel-preset-css-prop"]
}
```

`@emotion/babel-preset-css-prop` includes the emotion plugin. The `babel-plugin-emotion` entry should be be removed from your config and any options moved to the preset. If you use `@babel/preset-react` or `@babel/preset-typescript` ensure that `@emotion/babel-preset-css-prop` is inserted after them in your babel config.

```diff
{
+ "presets": [
+   [
+     "@emotion/babel-preset-css-prop",
+     {
+       "autoLabel": true,
+       "labelFormat": "[local]"
+     }
+   ]
+ ],
- "plugins": [
-   [
-     "emotion",
-     {
-       "autoLabel": true,
-       "labelFormat": "[local]"
-     }
-   ]
- ]
}
```

See [the options documentation](#options) for more information.

### Via CLI

```bash
babel --presets @emotion/babel-preset-css-prop script.js
```

### Via Node API

```javascript
require('@babel/core').transform(code, {
  presets: ['@emotion/babel-preset-css-prop']
})
```

## Features

This preset enables the `css` prop for an entire project via a single entry to the babel configuration. After adding the preset, compiled jsx code will use emotion's `jsx` function instead of `React.createElement`.

|        | Input                      | Output                                              |
| ------ | -------------------------- | --------------------------------------------------- |
| Before | `<img src="avatar.png" />` | `React.createElement('img', { src: 'avatar.png' })` |
| After  | `<img src="avatar.png" />` | `jsx('img', { src: 'avatar.png' })`                 |

`import { jsx } from '@emotion/core'` is automatically added to the top of files where required.

## Example

**In**

```javascript
const Link = props => (
  <a
    css={{
      color: 'hotpink',
      '&:hover': {
        color: 'darkorchid'
      }
    }}
    {...props}
  />
)
```

**Out**

```javascript
import { jsx as ___EmotionJSX } from '@emotion/core'

function _extends() {
  /* babel Object.assign polyfill */
}

var _ref =
  process.env.NODE_ENV === 'production'
    ? {
        name: '1fpk7dx-Link',
        styles: 'color:hotpink;&:hover{color:darkorchid;}label:Link;'
      }
    : {
        name: '1fpk7dx-Link',
        styles: 'color:hotpink;&:hover{color:darkorchid;}label:Link;',
        map:
          '/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImF1dG9tYXRpYy1pbXBvcnQuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBRUkiLCJmaWxlIjoiYXV0b21hdGljLWltcG9ydC5qcyIsInNvdXJjZXNDb250ZW50IjpbImNvbnN0IExpbmsgPSBwcm9wcyA9PiAoXG4gIDxhXG4gICAgY3NzPXt7XG4gICAgICBjb2xvcjogJ2hvdHBpbmsnLFxuICAgICAgJyY6aG92ZXInOiB7XG4gICAgICAgIGNvbG9yOiAnZGFya29yY2hpZCdcbiAgICAgIH1cbiAgICB9fVxuICAgIHsuLi5wcm9wc31cbiAgLz5cbilcbiJdfQ== */'
      }

const Link = props =>
  ___EmotionJSX(
    'a',
    _extends(
      {
        css: _ref
      },
      props
    )
  )
```

_In addition to the custom pragma, this example includes `babel-plugin-emotion` transforms that are enabled by default._

## Options

Options for both `babel-plugin-emotion` and `@babel/plugin-transform-react-jsx` are supported and will be forwarded to their respective plugin.

> Refer to the plugin's documentation for full option documentation.
>
> - [`babel-plugin-emotion`](https://emotion.sh/docs/babel)
>
> - [`@babel/plugin-transform-react-jsx`](https://babeljs.io/docs/en/next/babel-plugin-transform-react-jsx)

### Examples

```json
{
  "presets": [
    "@emotion/babel-preset-css-prop",
    {
      "autoLabel": true,
      "labelFormat": "[local]",
      "useBuiltIns": false,
      "throwIfNamespace": true
    }
  ]
}
```

_Options set to default values for demonstration purposes._
