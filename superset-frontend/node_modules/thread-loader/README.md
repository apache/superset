[![npm][npm]][npm-url]
[![deps][deps]][deps-url]
[![test][test]][test-url]
[![coverage][cover]][cover-url]
[![chat][chat]][chat-url]

<div align="center">
  <a href="https://webpack.js.org/">
    <img width="200" height="200" vspace="" hspace="25" src="https://cdn.rawgit.com/webpack/media/e7485eb2/logo/icon-square-big.svg">
  </a>
  <h1>thread-loader</h1>
  <p>Runs the following loaders in a worker pool.</p>
</div>

<h2 align="center">Install</h2>

```bash
npm install --save-dev thread-loader
```

<h2 align="center">Usage</h2>

Put this loader in front of other loaders. The following loaders run in a worker pool.

Loaders running in a worker pool are limited. Examples:

* Loaders cannot emit files.
* Loaders cannot use custom loader API (i. e. by plugins).
* Loaders cannot access the webpack options.

Each worker is a separate node.js process, which has an overhead of ~600ms. There is also an overhead of inter-process communication.

Use this loader only for expensive operations!

<h2 align="center">Examples</h2>

**webpack.config.js**

```js
module.exports = {
  module: {
    rules: [
      {
        test: /\.js$/,
        include: path.resolve("src"),
        use: [
          "thread-loader",
          // your expensive loader (e.g babel-loader)
        ]
      }
    ]
  }
}
```

**with options**

```js
use: [
  {
    loader: "thread-loader",
    // loaders with equal options will share worker pools
    options: {
      // the number of spawned workers, defaults to number of cpus
      workers: 2,

      // number of jobs a worker processes in parallel
      // defaults to 20
      workerParallelJobs: 50,

      // additional node.js arguments
      workerNodeArgs: ['--max-old-space-size=1024'],

      // timeout for killing the worker processes when idle
      // defaults to 500 (ms)
      // can be set to Infinity for watching builds to keep workers alive
      poolTimeout: 2000,

      // number of jobs the poll distributes to the workers
      // defaults to 200
      // decrease of less efficient but more fair distribution
      poolParallelJobs: 50,

      // name of the pool
      // can be used to create different pools with elsewise identical options
      name: "my-pool"
    }
  },
  // your expensive loader (e.g babel-loader)
]
```

**prewarming**

To prevent the high delay when booting workers it possible to warmup the worker pool.

This boots the max number of workers in the pool and loads specified modules into the node.js module cache.

``` js
const threadLoader = require('thread-loader');

threadLoader.warmup({
  // pool options, like passed to loader options
  // must match loader options to boot the correct pool
}, [
  // modules to load
  // can be any module, i. e.
  'babel-loader',
  'babel-preset-es2015',
  'sass-loader',
]);
```


<h2 align="center">Maintainers</h2>

<table>
  <tbody>
    <tr>
      <td align="center">
        <a href="https://github.com/sokra">
          <img width="150" height="150" src="https://github.com/sokra.png?size=150">
          </br>
          sokra
        </a>
      </td>
    </tr>
  <tbody>
</table>


[npm]: https://img.shields.io/npm/v/thread-loader.svg
[npm-url]: https://npmjs.com/package/thread-loader

[deps]: https://david-dm.org/webpack-contrib/thread-loader.svg
[deps-url]: https://david-dm.org/webpack-contrib/thread-loader

[chat]: https://img.shields.io/badge/gitter-webpack%2Fwebpack-brightgreen.svg
[chat-url]: https://gitter.im/webpack/webpack

[test]: http://img.shields.io/travis/webpack-contrib/thread-loader.svg
[test-url]: https://travis-ci.org/webpack-contrib/thread-loader

[cover]: https://codecov.io/gh/webpack-contrib/thread-loader/branch/master/graph/badge.svg
[cover-url]: https://codecov.io/gh/webpack-contrib/thread-loader
