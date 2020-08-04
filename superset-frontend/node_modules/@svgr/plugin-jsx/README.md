# @svgr/plugin-jsx

[![Build Status](https://img.shields.io/travis/smooth-code/svgr.svg)](https://travis-ci.org/smooth-code/svgr)
[![Version](https://img.shields.io/npm/v/@svgr/plugin-jsx.svg)](https://www.npmjs.com/package/@svgr/plugin-jsx)
[![MIT License](https://img.shields.io/npm/l/@svgr/plugin-jsx.svg)](https://github.com/smooth-code/svgr/blob/master/LICENSE)

Transforms SVG into JSX.

## Install

```
npm install --save-dev @svgr/plugin-jsx
```

## Usage

**.svgrrc**

```json
{
  "plugins": ["@svgr/plugin-jsx"]
}
```

## How does it work?

`@svgr/plugin-jsx` consists in three phases:

- Parsing the SVG code using [svg-parser](https://github.com/Rich-Harris/svg-parser)
- Converting the [HAST](https://github.com/syntax-tree/hast) into a [Babel AST](https://github.com/babel/babel/blob/master/packages/babel-parser/ast/spec.md)
- Applying [`@svgr/babel-preset`](../babel-preset/README.md) transformations

## Applying custom transformations

You can extend the Babel config applied in this plugin using `jsx.babelConfig` config path:

```js
// .svgrrc.js

module.exports = {
  jsx: {
    babelConfig: {
      plugins: [
        // For an example, this plugin will remove "id" attribute from "svg" tag
        [
          '@svgr/babel-plugin-remove-jsx-attribute',
          {
            elements: ['svg'],
            attributes: ['id'],
          },
        ],
      ],
    },
  },
}
```

Several Babel plugins are available:

- [`@svgr/babel-plugin-add-jsx-attribute`](../babel-plugin-add-jsx-attribute/README.md)
- [`@svgr/babel-plugin-remove-jsx-attribute`](../babel-plugin-remove-jsx-attribute/README.md)
- [`@svgr/babel-plugin-remove-jsx-empty-expression`](../babel-plugin-remove-jsx-empty-expression/README.md)
- [`@svgr/babel-plugin-replace-jsx-attribute-value`](../babel-plugin-replace-jsx-attribute-value/README.md)
- [`@svgr/babel-plugin-svg-dynamic-title`](../babel-plugin-svg-dynamic-title/README.md)
- [`@svgr/babel-plugin-svg-em-dimensions`](../babel-plugin-svg-em-dimensions/README.md)
- [`@svgr/babel-plugin-transform-react-native-svg`](../babel-plugin-transform-react-native-svg/README.md)
- [`@svgr/babel-plugin-transform-svg-component`](../babel-plugin-transform-svg-component/README.md)

If you want to create your own, reading [Babel Handbook](https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md) is a good start!

## License

MIT
