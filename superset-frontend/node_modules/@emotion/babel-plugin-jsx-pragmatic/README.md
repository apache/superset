# @emotion/babel-plugin-jsx-pragmatic

This package is a fork of [babel-plugin-jsx-pragmatic](https://github.com/jmm/babel-plugin-jsx-pragmatic) to support React Fragments.

The original README of babel-plugin-jsx-pragmatic with some modifications is shown below.

---

[@babel/plugin-transform-react-jsx](https://babeljs.io/docs/en/next/babel-plugin-transform-react-jsx.html) has a `pragma` option that's used when transforming JSX to function calls instead of the default function `React.createElement`.

This Babel plugin is a companion to that feature that allows you to dynamically load a module associated with the `pragma` value.

Example:

Given this file:

```js
<Some jsx="element" />
```

babel would normally transform the JSX to:

```js
React.createElement(Some, { jsx: 'element' })
```

By setting the `pragma` option like this:

```js
babel.transform(code, {
  plugins: [
    [
      'babel-plugin-transform-react-jsx',
      {
        pragma: 'whatever'
      }
    ]
  ]
})
```

It would instead transform it to:

```js
whatever(Some, { jsx: 'element' })
```

However, you might need to load a module corresponding to `whatever` in each module containing JSX:

```js
import whatever from 'whatever'
// or
var whatever = require('whatever')
```

This plugin allows you to make that part dynamic as well:

```js
babel.transform(code, {
  plugins: [
    [
      'babel-plugin-transform-react-jsx',
      {
        pragma: 'whatever'
      }
    ],

    [
      '@emotion/babel-plugin-jsx-pragmatic',
      {
        module: '/something/whatever',
        import: 'whatever'
      }
    ]
  ]
})
```

Results in:

```js
import { default as whatever } from '/something/whatever'
```

## Options

### `module`

String. Module ID or pathname. The value of the `ModuleSpecifier` of an import. Required.

### `import`

String. The identifier that you want to import the `module` with. This should correspond to the root identifier of the `pragma` value. Required. Examples:

```js
{
  plugins: [
    [
      'babel-plugin-transform-react-jsx',
      {
        pragma: 'x'
      }
    ],

    [
      '@emotion/babel-plugin-jsx-pragmatic',
      {
        module: '/something/whatever',
        import: 'x'
      }
    ]
  ]
}

{
  plugins: [
    [
      'babel-plugin-transform-react-jsx',
      {
        pragma: 'x.y'
      }
    ],

    [
      '@emotion/babel-plugin-jsx-pragmatic',
      {
        module: '/something/whatever',
        import: 'x'
      }
    ]
  ]
}
```

### `export`

String. The export that you want to import as `import` from `module`. Default value is `default` (the default export). Examples:

```js
// Will import the default export (`default`)
{
  module: "whatever",
  import: "x"
}
// import {default as x} from "whatever"


// Will import the default export (`default`)
{
  module: "whatever",
  import: "x",
  export: "default",
}
// import {default as x} from "whatever"


// Will import the export named `something`
{
  module: "whatever",
  import: "x",
  export: "something",
}
// import {something as x} from "whatever"
```

# Known Issues

- Doesn't do anything special in the case that the file being transformed
  already imports or declares an identifier with the same name as `import`.

- Doesn't take into account when a file actually contains a JSX pragma comment.
