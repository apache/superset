[![npm][npm]][npm-url]
[![node][node]][node-url]
[![npm-stats][npm-stats]][npm-url]
[![deps][deps]][deps-url]
[![travis][travis]][travis-url]
[![appveyor][appveyor]][appveyor-url]
[![coverage][coverage]][coverage-url]
[![chat][chat]][chat-url]

<div align="center">
  <img width="200" height="200"
    src="https://cdn.worldvectorlogo.com/logos/less-63.svg">
  <a href="https://github.com/webpack/webpack">
    <img width="200" height="200"
      src="https://webpack.js.org/assets/icon-square-big.svg">
  </a>
</div>

<h1 align="center">less-loader</h1>

<p align="center">Compiles Less to CSS.</p>

Use the [`css-loader`](https://github.com/webpack-contrib/css-loader) or the [`raw-loader`](https://github.com/webpack-contrib/raw-loader) to turn it into a JS module and the [ExtractTextPlugin](https://github.com/webpack-contrib/extract-text-webpack-plugin) to extract it into a separate file.


<h2 align="center">Install</h2>

```bash
npm install --save-dev less-loader less
```

The `less-loader` requires [less](https://github.com/less/less.js) as [`peerDependency`](https://docs.npmjs.com/files/package.json#peerdependencies). Thus you are able to control the versions accurately.

<h2 align="center">Examples</h2>

Chain the `less-loader` with the [`css-loader`](https://github.com/webpack-contrib/css-loader) and the [`style-loader`](https://github.com/webpack-contrib/style-loader) to immediately apply all styles to the DOM.

```js
// webpack.config.js
module.exports = {
    ...
    module: {
        rules: [{
            test: /\.less$/,
            use: [{
                loader: "style-loader" // creates style nodes from JS strings
            }, {
                loader: "css-loader" // translates CSS into CommonJS
            }, {
                loader: "less-loader" // compiles Less to CSS
            }]
        }]
    }
};
```

You can pass any Less specific options to the `less-loader` via [loader options](https://webpack.js.org/configuration/module/#rule-options-rule-query). See the [Less documentation](http://lesscss.org/usage/#command-line-usage-options) for all available options in dash-case. Since we're passing these options to Less programmatically, you need to pass them in camelCase here:

```js
// webpack.config.js
module.exports = {
    ...
    module: {
        rules: [{
            test: /\.less$/,
            use: [{
                loader: "style-loader"
            }, {
                loader: "css-loader"
            }, {
                loader: "less-loader", options: {
                    strictMath: true,
                    noIeCompat: true
                }
            }]
        }]
    }
};
```

Unfortunately, Less doesn't map all options 1-by-1 to camelCase. When in doubt, [check their executable and search for the dash-case option](https://github.com/less/less.js/blob/3.x/bin/lessc).

### In production

Usually, it's recommended to extract the style sheets into a dedicated file in production using the [ExtractTextPlugin](https://github.com/webpack-contrib/extract-text-webpack-plugin). This way your styles are not dependent on JavaScript:

```js
const ExtractTextPlugin = require("extract-text-webpack-plugin");

const extractLess = new ExtractTextPlugin({
    filename: "[name].[contenthash].css",
    disable: process.env.NODE_ENV === "development"
});

module.exports = {
    ...
    module: {
        rules: [{
            test: /\.less$/,
            use: extractLess.extract({
                use: [{
                    loader: "css-loader"
                }, {
                    loader: "less-loader"
                }],
                // use style-loader in development
                fallback: "style-loader"
            })
        }]
    },
    plugins: [
        extractLess
    ]
};
```

<h2 align="center">Usage</h2>

### Imports

Starting with `less-loader` 4, you can now choose between Less' builtin resolver and webpack's resolver. By default, webpack's resolver is used.

#### webpack resolver

webpack provides an [advanced mechanism to resolve files](https://webpack.js.org/configuration/resolve/). The `less-loader` applies a Less plugin that passes all queries to the webpack resolver. Thus you can import your Less modules from `node_modules`. Just prepend them with a `~` which tells webpack to look up the [`modules`](https://webpack.js.org/configuration/resolve/#resolve-modules).

```css
@import "~bootstrap/less/bootstrap";
```

It's important to only prepend it with `~`, because `~/` resolves to the home-directory. webpack needs to distinguish between `bootstrap` and `~bootstrap`, because CSS and Less files have no special syntax for importing relative files. Writing `@import "file"` is the same as `@import "./file";`

##### Non-Less imports

Using webpack's resolver, you can import any file type. You just need a loader that exports valid Less code. Often, you will also want to set the `issuer` condition to ensure that this rule is only applied on imports originating from Less files:

```js
// webpack.config.js
module.exports = {
    ...
    module: {
        rules: [{
            test: /\.js$/,
            issuer: /\.less$/,
            use: [{
                loader: "js-to-less-loader"
            }]
        }]
    }
};
```

#### Less resolver

If you specify the `paths` option, the `less-loader` will not use webpack's resolver. Modules, that can't be resolved in the local folder, will be searched in the given `paths`. This is Less' default behavior. `paths` should be an array with absolute paths:

```js
// webpack.config.js
module.exports = {
    ...
    module: {
        rules: [{
            test: /\.less$/,
            use: [{
                loader: "style-loader"
            }, {
                loader: "css-loader"
            }, {
                loader: "less-loader", options: {
                    paths: [
                        path.resolve(__dirname, "node_modules")
                    ]
                }
            }]
        }]
    }
};
```

In this case, all webpack features like importing non-Less files or aliasing won't work of course.

### Plugins

In order to use [plugins](http://lesscss.org/usage/#plugins), simply set the `plugins` option like this:

```js
// webpack.config.js
const CleanCSSPlugin = require("less-plugin-clean-css");

module.exports = {
    ...
            {
                loader: "less-loader", options: {
                    plugins: [
                        new CleanCSSPlugin({ advanced: true })
                    ]
                }
            }]
    ...
};
```

### Extracting style sheets

Bundling CSS with webpack has some nice advantages like referencing images and fonts with hashed urls or [hot module replacement](https://webpack.js.org/concepts/hot-module-replacement/) in development. In production, on the other hand, it's not a good idea to apply your style sheets depending on JS execution. Rendering may be delayed or even a [FOUC](https://en.wikipedia.org/wiki/Flash_of_unstyled_content) might be visible. Thus it's often still better to have them as separate files in your final production build.

There are two possibilities to extract a style sheet from the bundle:

- [`extract-loader`](https://github.com/peerigon/extract-loader) (simpler, but specialized on the css-loader's output)
- [`ExtractTextWebpackPlugin`](https://github.com/webpack-contrib/extract-text-webpack-plugin) (more complex, but works in all use-cases)

### Source maps

To enable CSS source maps, you'll need to pass the `sourceMap` option to the `less-loader` *and* the `css-loader`. Your `webpack.config.js` should look like this:

```javascript
module.exports = {
    ...
    module: {
        rules: [{
            test: /\.less$/,
            use: [{
                loader: "style-loader"
            }, {
                loader: "css-loader", options: {
                    sourceMap: true
                }
            }, {
                loader: "less-loader", options: {
                    sourceMap: true
                }
            }]
        }]
    }
};
```

Also checkout the [sourceMaps example](https://github.com/webpack-contrib/less-loader/tree/master/examples/sourceMaps).

If you want to edit the original Less files inside Chrome, [there's a good blog post](https://medium.com/@toolmantim/getting-started-with-css-sourcemaps-and-in-browser-sass-editing-b4daab987fb0). The blog post is about Sass but it also works for Less.

### CSS modules gotcha

There is a known problem with Less and [CSS modules](https://github.com/css-modules/css-modules) regarding relative file paths in `url(...)` statements. [See this issue for an explanation](https://github.com/webpack-contrib/less-loader/issues/109#issuecomment-253797335).

<h2 align="center">Maintainer</h2>

<table>
    <tr>
      <td align="center">
        <a href="https://github.com/jhnns"><img width="150" height="150" src="https://github.com/jhnns.png?s=150"></a>
        <br>
        <a href="https://github.com/jhnns">Johannes Ewald</a>
      </td>
    <tr>
</table>


[npm]: https://img.shields.io/npm/v/less-loader.svg
[npm-stats]: https://img.shields.io/npm/dm/less-loader.svg
[npm-url]: https://npmjs.com/package/less-loader

[node]: https://img.shields.io/node/v/less-loader.svg
[node-url]: https://nodejs.org

[deps]: https://david-dm.org/webpack-contrib/less-loader.svg
[deps-url]: https://david-dm.org/webpack-contrib/less-loader

[travis]: http://img.shields.io/travis/webpack-contrib/less-loader.svg
[travis-url]: https://travis-ci.org/webpack-contrib/less-loader

[appveyor-url]: https://ci.appveyor.com/project/jhnns/less-loader/branch/master
[appveyor]: https://ci.appveyor.com/api/projects/status/github/webpack-contrib/less-loader?svg=true

[coverage]: https://img.shields.io/codecov/c/github/webpack-contrib/less-loader.svg
[coverage-url]: https://codecov.io/gh/webpack-contrib/less-loader

[chat]: https://badges.gitter.im/webpack-contrib/webpack.svg
[chat-url]: https://gitter.im/webpack-contrib/webpack
