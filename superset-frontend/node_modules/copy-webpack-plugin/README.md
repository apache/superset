<div align="center">
  <a href="https://github.com/webpack/webpack">
    <img width="200" height="200"
      src="https://webpack.js.org/assets/icon-square-big.svg">
  </a>
</div>

[![npm][npm]][npm-url]
[![node][node]][node-url]
[![deps][deps]][deps-url]
[![tests][tests]][tests-url]
[![cover][cover]][cover-url]
[![chat][chat]][chat-url]
[![size][size]][size-url]

# copy-webpack-plugin

Copies individual files or entire directories, which already exist, to the build directory.

## Getting Started

To begin, you'll need to install `copy-webpack-plugin`:

```console
$ npm install copy-webpack-plugin --save-dev
```

Then add the plugin to your `webpack` config. For example:

**webpack.config.js**

```js
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  plugins: [
    new CopyPlugin([
      { from: 'source', to: 'dest' },
      { from: 'other', to: 'public' },
    ]),
  ],
};
```

> ℹ️ `webpack-copy-plugin` is not designed to copy files generated from the build process; rather, it is to copy files that already exist in the source tree, as part of the build process.

> ℹ️ If you want `webpack-dev-server` to write files to the output directory during development, you can force it with the [`writeToDisk`](https://github.com/webpack/webpack-dev-middleware#writetodisk) option or the [`write-file-webpack-plugin`](https://github.com/gajus/write-file-webpack-plugin).

## Options

The plugin's signature:

**webpack.config.js**

```js
module.exports = {
  plugins: [new CopyPlugin(patterns, options)],
};
```

### Patterns

|               Name                |        Type         |                     Default                     | Description                                                                                           |
| :-------------------------------: | :-----------------: | :---------------------------------------------: | :---------------------------------------------------------------------------------------------------- |
|          [`from`](#from)          | `{String\|Object}`  |                   `undefined`                   | Glob or path from where we сopy files.                                                                |
|            [`to`](#to)            |     `{String}`      |            `compiler.options.output`            | Output path.                                                                                          |
|       [`context`](#context)       |     `{String}`      | `options.context \|\| compiler.options.context` | A path that determines how to interpret the `from` path.                                              |
|        [`toType`](#totype)        |     `{String}`      |                   `undefined`                   | Determinate what is `to` option - directory, file or template.                                        |
|          [`test`](#test)          | `{String\|RegExp}`  |                   `undefined`                   | Pattern for extracting elements to be used in `to` templates.                                         |
|         [`force`](#force)         |     `{Boolean}`     |                     `false`                     | Overwrites files already in `compilation.assets` (usually added by other plugins/loaders).            |
|        [`ignore`](#ignore)        |      `{Array}`      |                      `[]`                       | Globs to ignore files.                                                                                |
|       [`flatten`](#flatten)       |     `{Boolean}`     |                     `false`                     | Removes all directory references and only copies file names.                                          |
|         [`cache`](#cache)         | `{Boolean\|Object}` |                     `false`                     | Enable `transform` caching. You can use `{ cache: { key: 'my-cache-key' } }` to invalidate the cache. |
|     [`transform`](#transform)     |    `{Function}`     |                   `undefined`                   | Allows to modify the file contents.                                                                   |
| [`transformPath`](#transformpath) |    `{Function}`     |                   `undefined`                   | Allows to modify the writing path.                                                                    |

#### `from`

Type: `String|Object`
Default: `undefined`

Glob or path from where we сopy files.
Globs accept [minimatch options](https://github.com/isaacs/minimatch).

You can define `from` as `Object` and use the [`node-glob` options](https://github.com/isaacs/node-glob#options).

> ⚠️ Don't use directly `\\` in `from` (i.e `path\to\file.ext`) option because on UNIX the backslash is a valid character inside a path component, i.e., it's not a separator.
> On Windows, the forward slash and the backward slash are both separators.
> Instead please use `/` or `path` methods.

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin([
      'relative/path/to/file.ext',
      '/absolute/path/to/file.ext',
      'relative/path/to/dir',
      '/absolute/path/to/dir',
      '**/*',
      {
        from: '**/*',
        globOptions: {
          dot: false,
        },
      },
    ]),
  ],
};
```

#### `to`

Type: `String`
Default: `compiler.options.output`

Output path.

> ⚠️ Don't use directly `\\` in `to` (i.e `path\to\dest`) option because on UNIX the backslash is a valid character inside a path component, i.e., it's not a separator.
> On Windows, the forward slash and the backward slash are both separators.
> Instead please use `/` or `path` methods.

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin([
      {
        from: '**/*',
        to: 'relative/path/to/dest/',
      },
      {
        from: '**/*',
        to: '/absolute/path/to/dest/',
      },
      {
        from: '**/*',
        to: '[path][name].[contenthash].[ext]',
      },
    ]),
  ],
};
```

#### `context`

Type: `String`
Default: `options.context|compiler.options.context`

A path that determines how to interpret the `from` path.

> ⚠️ Don't use directly `\\` in `context` (i.e `path\to\context`) option because on UNIX the backslash is a valid character inside a path component, i.e., it's not a separator.
> On Windows, the forward slash and the backward slash are both separators.
> Instead please use `/` or `path` methods.

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin([
      {
        from: 'src/*.txt',
        to: 'dest/',
        context: 'app/',
      },
    ]),
  ],
};
```

#### `toType`

Type: `String`
Default: `undefined`

Determinate what is `to` option - directory, file or template.
Sometimes it is hard to say what is `to`, example `path/to/dir-with.ext`.
If you want to copy files in directory you need use `dir` option.
We try to automatically determine the `type` so you most likely do not need this option.

|       Name       |    Type    |   Default   | Description                                                                                        |
| :--------------: | :--------: | :---------: | :------------------------------------------------------------------------------------------------- |
|   **`'dir'`**    | `{String}` | `undefined` | If `from` is directory, `to` has no extension or ends in `'/'`                                     |
|   **`'file'`**   | `{String}` | `undefined` | If `to` has extension or `from` is file                                                            |
| **`'template'`** | `{String}` | `undefined` | If `to` contains [a template pattern](https://github.com/webpack-contrib/file-loader#placeholders) |

##### `'dir'`

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin([
      {
        from: 'path/to/file.txt',
        to: 'directory/with/extension.ext',
        toType: 'dir',
      },
    ]),
  ],
};
```

##### `'file'`

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin([
      {
        from: 'path/to/file.txt',
        to: 'file/without/extension',
        toType: 'file',
      },
    ]),
  ],
};
```

##### `'template'`

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin([
      {
        from: 'src/',
        to: 'dest/[name].[hash].[ext]',
        toType: 'template',
      },
    ]),
  ],
};
```

#### `test`

Type: `string|RegExp`
Default: `undefined`

Pattern for extracting elements to be used in `to` templates.

Defines a `{RegExp}` to match some parts of the file path.
These capture groups can be reused in the name property using `[N]` placeholder.
Note that `[0]` will be replaced by the entire path of the file,
whereas `[1]` will contain the first capturing parenthesis of your `{RegExp}`
and so on...

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin([
      {
        from: '*/*',
        to: '[1]-[2].[hash].[ext]',
        test: /([^/]+)\/(.+)\.png$/,
      },
    ]),
  ],
};
```

#### `force`

Type: `Boolean`
Default: `false`

Overwrites files already in `compilation.assets` (usually added by other plugins/loaders).

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin([
      {
        from: 'src/**/*',
        to: 'dest/',
        force: true,
      },
    ]),
  ],
};
```

#### `ignore`

Type: `Array`
Default: `[]`

Globs to ignore files.

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin([
      {
        from: 'src/**/*',
        to: 'dest/',
        ignore: ['*.js'],
      },
    ]),
  ],
};
```

> ⚠️ Note that only relative path should be provided to ignore option, an example to ignore `src/assets/subfolder/ignorfile.js` :

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin([
      {
        from: 'src/assets',
        to: 'dest/',
        ignore: ['subfolder/ingorefile.js'],
      },
    ]),
  ],
};
```

#### `flatten`

Type: `Boolean`
Default: `false`

Removes all directory references and only copies file names.

> ⚠️ If files have the same name, the result is non-deterministic.

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin([
      {
        from: 'src/**/*',
        to: 'dest/',
        flatten: true,
      },
    ]),
  ],
};
```

#### `cache`

Type: `Boolean|Object`
Default: `false`

Enable/disable `transform` caching. You can use `{ cache: { key: 'my-cache-key' } }` to invalidate the cache.
Default path to cache directory: `node_modules/.cache/copy-webpack-plugin`.

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin([
      {
        from: 'src/*.png',
        to: 'dest/',
        transform(content, path) {
          return optimize(content);
        },
        cache: true,
      },
    ]),
  ],
};
```

#### `transform`

Type: `Function`
Default: `undefined`

Allows to modify the file contents.

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin([
      {
        from: 'src/*.png',
        to: 'dest/',
        transform(content, path) {
          return optimize(content);
        },
      },
    ]),
  ],
};
```

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin([
      {
        from: 'src/*.png',
        to: 'dest/',
        transform(content, path) {
          return Promise.resolve(optimize(content));
        },
      },
    ]),
  ],
};
```

#### `transformPath`

Type: `Function`
Default: `undefined`

Allows to modify the writing path.

> ⚠️ Don't return directly `\\` in `transformPath` (i.e `path\to\newFile`) option because on UNIX the backslash is a valid character inside a path component, i.e., it's not a separator.
> On Windows, the forward slash and the backward slash are both separators.
> Instead please use `/` or `path` methods.

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin([
      {
        from: 'src/*.png',
        to: 'dest/',
        transformPath(targetPath, absolutePath) {
          return 'newPath';
        },
      },
    ]),
  ],
};
```

**webpack.config.js**

```js
module.exports = {
  plugins: [
    new CopyPlugin([
      {
        from: 'src/*.png',
        to: 'dest/',
        transformPath(targetPath, absolutePath) {
          return Promise.resolve('newPath');
        },
      },
    ]),
  ],
};
```

### Options

|                Name                 |    Type     |          Default           | Description                                                                                                                                       |
| :---------------------------------: | :---------: | :------------------------: | :------------------------------------------------------------------------------------------------------------------------------------------------ |
|       [`logLevel`](#loglevel)       | `{String}`  |        **`'warn'`**        | Level of messages that the module will log                                                                                                        |
|         [`ignore`](#ignore)         |  `{Array}`  |            `[]`            | Array of globs to ignore (applied to `from`)                                                                                                      |
|        [`context`](#context)        | `{String}`  | `compiler.options.context` | A path that determines how to interpret the `from` path, shared for all patterns                                                                  |
| [`copyUnmodified`](#copyunmodified) | `{Boolean}` |          `false`           | Copies files, regardless of modification when using watch or `webpack-dev-server`. All files are copied on first build, regardless of this option |

#### `logLevel`

This property defines the level of messages that the module will log. Valid levels include:

- `trace`
- `debug`
- `info`
- `warn` (default)
- `error`
- `silent`

Setting a log level means that all other levels below it will be visible in the
console. Setting `logLevel: 'silent'` will hide all console output. The module
leverages [`webpack-log`](https://github.com/webpack-contrib/webpack-log#readme)
for logging management, and more information can be found on its page.

**webpack.config.js**

```js
module.exports = {
  plugins: [new CopyPlugin([...patterns], { logLevel: 'debug' })],
};
```

#### `ignore`

Array of globs to ignore (applied to `from`).

**webpack.config.js**

```js
module.exports = {
  plugins: [new CopyPlugin([...patterns], { ignore: ['*.js', '*.css'] })],
};
```

#### `context`

A path that determines how to interpret the `from` path, shared for all patterns.

**webpack.config.js**

```js
module.exports = {
  plugins: [new CopyPlugin([...patterns], { context: '/app' })],
};
```

#### `copyUnmodified`

Copies files, regardless of modification when using watch or `webpack-dev-server`. All files are copied on first build, regardless of this option.

> ℹ️ By default, we only copy **modified** files during a `webpack --watch` or `webpack-dev-server` build. Setting this option to `true` will copy all files.

**webpack.config.js**

```js
module.exports = {
  plugins: [new CopyPlugin([...patterns], { copyUnmodified: true })],
};
```

## Contributing

Please take a moment to read our contributing guidelines if you haven't yet done so.

[CONTRIBUTING](./.github/CONTRIBUTING.md)

## License

[MIT](./LICENSE)

[npm]: https://img.shields.io/npm/v/copy-webpack-plugin.svg
[npm-url]: https://npmjs.com/package/copy-webpack-plugin
[node]: https://img.shields.io/node/v/copy-webpack-plugin.svg
[node-url]: https://nodejs.org
[deps]: https://david-dm.org/webpack-contrib/copy-webpack-plugin.svg
[deps-url]: https://david-dm.org/webpack-contrib/copy-webpack-plugin
[tests]: https://dev.azure.com/webpack-contrib/copy-webpack-plugin/_apis/build/status/webpack-contrib.copy-webpack-plugin?branchName=master
[tests-url]: https://dev.azure.com/webpack-contrib/copy-webpack-plugin/_build/latest?definitionId=5&branchName=master
[cover]: https://codecov.io/gh/webpack-contrib/copy-webpack-plugin/branch/master/graph/badge.svg
[cover-url]: https://codecov.io/gh/webpack-contrib/copy-webpack-plugin
[chat]: https://img.shields.io/badge/gitter-webpack%2Fwebpack-brightgreen.svg
[chat-url]: https://gitter.im/webpack/webpack
[size]: https://packagephobia.now.sh/badge?p=copy-webpack-plugin
[size-url]: https://packagephobia.now.sh/result?p=copy-webpack-plugin
