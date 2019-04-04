css-modules-require-hook
========================

The require hook compiles [CSS Modules](https://github.com/css-modules/css-modules) in runtime. This is similar to Babel's [babel/register](https://babeljs.io/docs/usage/require/). See the example: [demo](demo).

## What is CSS Modules

A **CSS Module** is a CSS file in which all class names and animation names are scoped locally by default. Learn more in the article [CSS Modules - Welcome to the Future](http://glenmaddern.com/articles/css-modules) by Glen&nbsp;Maddern.

## Features

Compiling in runtime, [universal](https://medium.com/@mjackson/universal-javascript-4761051b7ae9) usage.


## Requirements

To use this tool we require [Node.js v0.12.x](https://github.com/nodejs/node) (or higher).

## Installation

```bash
$ npm i css-modules-require-hook
```

## Usage

Now, there are two ways to attach hook: manually or using preset file.

The first one allows you to pass options manually after module was required. Example:

```javascript
const hook = require('css-modules-require-hook');

hook({
  generateScopedName: '[name]__[local]___[hash:base64:5]',
});

// const styles = require('./icon.css');
```

The second one allows you to move options to the separate file `cmrh.conf.js`. Config file should be located in the same directory where executor is or in its ancestor directories. In that case hook will be attached right after the `css-modules-require-hook/preset` module will be required. Example:

```javascript
// cmrh.conf.js
module.exports = {
  generateScopedName: '[name]__[local]___[hash:base64:5]',
};
```

```javascript
require('css-modules-require-hook/preset');

// const styles = require('./icon.css');
```


### Using with babel-node / ES6 Imports
You will need to create a `cmrh.conf.js` file within the directory as you are importing `css-modules-require-hook`.


```javascript
// server.js
import csshook from 'css-modules-require-hook/preset' // import hook before routes
import routes from '/shared/views/routes'

// create server, etc
```

```javascript
// cmrh.conf.js
module.exports = {
  // Same scope name as in webpack build
  generateScopedName: '[name]__[local]___[hash:base64:5]',
}
```



### Development mode

Usually, Node.js caches all the `require` calls by default. In order to invalidate cache for the purpose of development you should set the environment variable `NODE_ENV` to `development`. For example:

```bash
$ NODE_ENV=development node server.js
```

Still you can use `devMode` option (see below) to override behavior which is imposed by environment variable.

### Adding custom PostCSS plugins

```javascript
var hook = require('css-modules-require-hook');
var cssnext = require('cssnext');

hook({
  prepend: [
    // adding CSS Next plugin
    cssnext(),
  ],
});
```

### Specify custom pattern to build generic names

```javascript
var hook = require('css-modules-require-hook');

hook({
  generateScopedName: '[name]__[local]___[hash:base64:5]',
});
```

### Using Stylus as a preprocessor

```javascript
var hook = require('css-modules-require-hook');
var stylus = require('stylus');

hook({
  extensions: ['.styl'],
  preprocessCss: function (css, filename) {
    return stylus(css)
      .set('filename', filename)
      .render();
  },
});

// var styles = require('./demo.styl');
```

## Tuning (options)

To adjust the require hook you need to provide params to the exported function.

```javascript
var hook = require('css-modules-require-hook');

hook({
  // append: [],
  // generateScopedName: function () {},
  // or any other options
  // see the list below
});
```

### `devMode` boolean

Helps you to invalidate cache of all `require` calls. Usually used for the development purpose. Also overrides behavior, imposed by `NODE_ENV` environment variable. For example:

```javascript
hook({
  devMode: false,
});
```

### `extensions` array

Attach the require hook to additional file extensions (for example `['.scss']`).

### `ignore` function|regex|string

Provides possibility to exclude particular files from processing. Supports glob and regular expressions syntax. Also you may provide custom function.

### `preprocessCss` function

In rare cases you may want to precompile styles, before they will be passed to the PostCSS pipeline. You should use **synchronous** transformations, since `require` function is synchronous.

```javascript
hook({
  /**
   * @param  {string} css
   * @param  {string} filepath Absolute path to the file
   * @return {string}
   */
  preprocessCss: function (css, filepath) {
    return css;
  }
});
```

### `processCss` function

In rare cases you may want to get compiled styles in runtime, so providing this option helps.

```javascript
hook({
  /**
   * @param  {string} css
   * @param  {string} filepath Absolute path to the file
   */
  processCss: function (css, filepath) { /* */ }
});
```

### `processorOpts` object

Provides possibility to pass custom options to the [LazyResult instance](https://github.com/postcss/postcss/blob/master/docs/api.md#processorprocesscss-opts). It can be usefull if you want to set the custom parser, for example: [postcss-less](https://github.com/gilt/postcss-less).

```javascript
const hook = require('css-modules-require-hook');
const lessParser = require('postcss-less').parse;

hook({
  extensions: '.less',
  processorOpts: {parser: lessParser},
});
```

### `camelCase boolean|string`

Camelizes exported class names. Similar to [css-loader?camelCase](https://github.com/webpack/css-loader#camel-case).

Available options: `true`, `dashes`, `only`, `dashesOnly`.

### `append` array

Appends custom plugins to the end of the PostCSS pipeline. Since the `require` function is synchronous, you should provide synchronous plugins only.

### `prepend` array

Prepends custom plugins to the beginning of the PostCSS pipeline. Since the `require` function is synchronous, you should provide synchronous plugins only.

### `use` array

Provides the full list of PostCSS plugins to the pipeline. Providing this cancels `append`, `prepend`, `createImportedName`, `generateScopedName` options. Synchronous plugins only.

### `createImportedName` function

Short alias for the [postcss-modules-extract-imports](https://github.com/css-modules/postcss-modules-extract-imports) plugin's `createImportedName` option.

### `generateScopedName` string|function

Short alias for the [postcss-modules-scope](https://github.com/css-modules/postcss-modules-scope) plugin's option. Helps you to specify the custom way to build generic names for the class selectors.
You may also use a string pattern similar to the webpack's [css-loader](https://github.com/webpack/css-loader#local-scope).

```javascript
hook({
  generateScopedName: '[name]__[local]___[hash:base64:5]'
});
```

or

```javascript
hook({
  /**
   * @param  {string} name     Usually a class name
   * @param  {string} filepath
   * @param  {string} css
   * @return {string}
   */
  generateScopedName: function (name, filepath, css) {
    return name;
  }
});
```

### `hashPrefix` string

Short alias for the [generic-names](https://github.com/css-modules/generic-names) helper option.
Provides additional hash uniqueness. Might be useful for projects with several stylesheets sharing a same name.

### `mode` string

Short alias for the [postcss-modules-local-by-default](https://github.com/css-modules/postcss-modules-local-by-default) plugin's option.


### `resolve` object

Changes the way the paths of ICSS imports will be resolved (`@value a from './b.css'` and `composes a from './b.css'`). Supports:

- `resolve.alias` `object`
- `resolve.extensions` `array` — default value is `['.css']`.
- `resolve.modules` `array`
- `resolve.mainFile` `array` — default value is `'index.css'`.
- `resolve.preserveSymlinks` `boolean` — default value is `false`.

See the detailed description at: https://github.com/css-modules/postcss-modules-resolve-imports#options


### `rootDir` string

Provides absolute path to the project directory. Providing this will result in better generated class names. It can be obligatory, if you run require hook and build tools (like [css-modulesify](https://github.com/css-modules/css-modulesify)) from different working directories.


## Debugging

[debug](https://www.npmjs.com/package/debug) package is used for debugging. So to turn it on simply specify the **DEBUG** environment variable:
- `DEBUG=css-modules:fetch` &mdash; to see resolved paths to the files.
- `DEBUG=css-modules:preset` &mdash; to see whether config was found or not.
- `DEBUG=css-modules:setup` &mdash; to see the new options list.
- `DEBUG=css-modules:*` &mdash; to see everything.

## Links

- Electron support: [css-modules-electron](https://github.com/KenPowers/css-modules-electron)

## License

> The MIT License
