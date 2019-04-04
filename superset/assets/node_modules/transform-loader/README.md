[![npm][npm]][npm-url]
[![deps][deps]][deps-url]
[![chat][chat]][chat-url]

<div align="center">
  <!-- replace with accurate logo e.g from https://worldvectorlogo.com/ -->
  <a href="https://github.com/webpack/webpack">
    <img width="200" height="200" vspace="" hspace="25"
      src="https://cdn.rawgit.com/webpack/media/e7485eb2/logo/icon.svg">
  </a>
  <h1>Transform Loader</h1>
  <p>Use a browserify transforms as webpack-loader.<p>
</div>

<h2 align="center">Install</h2>

```bash
npm i transform-loader --save
```

<h2 align="center">Usage</h2>

[Documentation: Using loaders](http://webpack.github.io/docs/using-loaders.html)

Pass the module name as query parameter.

``` javascript
var x = require("!transform-loader?brfs!./file.js");
var x = require("!transform-loader/cacheable?brfs!./file.js"); // cacheable version
```

If you pass a number instead it will take the function from `this.options.transforms[number]`.

<h2 align="center">Webpack 2.x Config Example</h2>

``` javascript
module.exports = {
  module: {
    rules: [
      {
        loader: "transform-loader?brfs",
        enforce: "post"
      },
			{
        test: /\.coffee$/,
        loader: "transform-loader/cacheable?coffeeify"
      },
      {
        test: /\.weirdjs$/,
        loader: "transform-loader?0"
      }
    ]
  },
  plugins: [
    new webpack.LoaderOptionsPlugin({
      options: {
        transforms: [
          function(file) {
            return through(function(buf) {
              this.queue(buf.split("").map(function(s) {
                return String.fromCharCode(127-s.charCodeAt(0));
              }).join(""));
            }, function() { this.queue(null); });
          }
        ]
      }
    })
  ]
};
```

<h2 align="center">Webpack 1.x Config Example</h2>

``` javascript
module.exports = {
	module: {
		postLoaders: [
			{
				loader: "transform-loader?brfs"
			}
		]
		loaders: [
			{
				test: /\.coffee$/,
				loader: "transform-loader/cacheable?coffeeify"
			},
			{
				test: /\.weirdjs$/,
				loader: "transform-loader?0"
			}
		]
	},
	transforms: [
		function(file) {
			return through(function(buf) {
				this.queue(buf.split("").map(function(s) {
					return String.fromCharCode(127-s.charCodeAt(0));
				}).join(""));
			}, function() { this.queue(null); });
		}
	]
};
```

<h2 align="center">Typical brfs Example</h2>

Say you have the following Node source:

```js
var test = require('fs').readFileSync('./test.txt', 'utf8');
```

After `npm install transform-loader brfs --save`, add the following loader to your config:

```js
module.exports = {
    context: __dirname,
    entry: "./index.js",
    module: {
        loaders: [
            {
                test: /\.js$/,
                loader: "transform-loader?brfs"
            }
        ]
    }
}
```

The loader is applied to all JS files, which can incur a performance hit with watch tasks. So you may want to use `transform-loader/cacheable?brfs` instead. 

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


[npm]: https://img.shields.io/npm/v/transform-loader.svg
[npm-url]: https://npmjs.com/package/transform-loader

[deps]: https://david-dm.org/webpack-contrib/transform-loader.svg
[deps-url]: https://david-dm.org/webpack-contrib/transform-loader

[chat]: https://img.shields.io/badge/gitter-webpack%2Fwebpack-brightgreen.svg
[chat-url]: https://gitter.im/webpack/webpack
