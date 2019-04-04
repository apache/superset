[![npm][npm]][npm-url]
[![deps][deps]][deps-url]
[![test][test]][test-url]
[![chat][chat]][chat-url]

<div align="center">
  <!-- replace with accurate logo e.g from https://worldvectorlogo.com/ -->
  <a href="https://github.com/webpack/webpack">
    <img width="200" height="200" vspace="" hspace="25"
      src="https://cdn.rawgit.com/webpack/media/e7485eb2/logo/icon.svg">
  </a>
  <h1>Imports Loader</h1>
  <p>The imports loader allows you to use modules that depend on specific global variables.<p>
</div>

This is useful for third-party modules that rely on global variables like `$` or `this` being the `window` object. The imports loader can add the necessary `require('whatever')` calls, so those modules work with webpack.

<h2 align="center">Install</h2>

```bash
npm install imports-loader
```

<h2 align="center">Usage</h2>

Given you have this file `example.js`

```javascript
$("img").doSomeAwesomeJqueryPluginStuff();
```

then you can inject the `$` variable into the module by configuring the imports-loader like this:

``` javascript
require("imports-loader?$=jquery!./example.js");
```

This simply prepends `var $ = require("jquery");` to `example.js`.

### Syntax

Query value | Equals
------------|-------
`angular` | `var angular = require("angular");`
`$=jquery` | `var $ = require("jquery");`
`define=>false` | `var define = false;`
`config=>{size:50}` | `var config = {size:50};`
`this=>window` | `(function () { ... }).call(window);`

### Multiple values

Multiple values are separated by comma `,`:

```javascript
require("imports-loader?$=jquery,angular,config=>{size:50}!./file.js");
```

### webpack.config.js

As always, you should rather configure this in your `webpack.config.js`:

```javascript
// ./webpack.config.js

module.exports = {
    ...
    module: {
        loaders: [
            {
                test: require.resolve("some-module"),
                loader: "imports-loader?this=>window"
            }
        ]
    }
};
```

[Documentation: Using loaders](http://webpack.github.io/docs/using-loaders.html)

<h2 align="center">Typical Use Cases</h2>

### jQuery plugins

`imports-loader?$=jquery`

### Custom Angular modules

`imports-loader?angular`

### Disable AMD

There are many modules that check for a `define` function before using CommonJS. Since webpack is capable of both, they default to AMD in this case, which can be a problem if the implementation is quirky.

Then you can easily disable the AMD path by writing

```javascript
imports-loader?define=>false
```

For further hints on compatibility issues, check out [Shimming Modules](http://webpack.github.io/docs/shimming-modules.html) of the official docs.

<h2 align="center">Maintainers</h2>

<table>
  <tbody>
    <tr>
      <td align="center">
        <img width="150" height="150"
        src="https://avatars3.githubusercontent.com/u/166921?v=3&s=150">
        </br>
        <a href="https://github.com/bebraw">Juho Vepsäläinen</a>
      </td>
      <td align="center">
        <img width="150" height="150"
        src="https://avatars2.githubusercontent.com/u/8420490?v=3&s=150">
        </br>
        <a href="https://github.com/d3viant0ne">Joshua Wiens</a>
      </td>
      <td align="center">
        <img width="150" height="150"
        src="https://avatars3.githubusercontent.com/u/533616?v=3&s=150">
        </br>
        <a href="https://github.com/SpaceK33z">Kees Kluskens</a>
      </td>
      <td align="center">
        <img width="150" height="150"
        src="https://avatars3.githubusercontent.com/u/3408176?v=3&s=150">
        </br>
        <a href="https://github.com/TheLarkInn">Sean Larkin</a>
      </td>
    </tr>
  <tbody>
</table>


[npm]: https://img.shields.io/npm/v/imports-loader.svg
[npm-url]: https://npmjs.com/package/imports-loader

[deps]: https://david-dm.org/webpack-contrib/imports-loader.svg
[deps-url]: https://david-dm.org/webpack-contrib/imports-loader

[chat]: https://img.shields.io/badge/gitter-webpack%2Fwebpack-brightgreen.svg
[chat-url]: https://gitter.im/webpack/webpack

[test]: http://img.shields.io/travis/webpack-contrib/imports-loader.svg
[test-url]: https://travis-ci.org/webpack-contrib/imports-loader
