[![npm][npm]][npm-url]
[![node][node]][node-url]
[![deps][deps]][deps-url]
[![test][test]][test-url]
[![coverage][cover]][cover-url]
[![chat][chat]][chat-url]

<div align="center">
  <a href="https://webpack.js.org/">
    <img width="200" height="200" src="https://cdn.rawgit.com/webpack/media/e7485eb2/logo/icon-square-big.svg">
  </a>
  <h1>Cache Loader</h1>
  <p>Caches the result of following loaders on disk (default) or in the database</p>
</div>

<h2 align="center">Install</h2>

```bash
npm install --save-dev cache-loader
```

<h2 align="center">Usage</h2>

Add this loader in front of other (expensive) loaders to cache the result on disk.

**webpack.config.js**
```js
module.exports = {
  module: {
    rules: [
      {
        test: /\.ext$/,
        use: [
          'cache-loader',
          ...loaders
        ],
        include: path.resolve('src')
      }
    ]
  }
}
```

> ⚠️ Note that there is an overhead for saving the reading and saving the cache file, so only use this loader to cache expensive loaders.

<h2 align="center">Options</h2>

|Name|Type|Default|Description|
|:--:|:--:|:-----:|:----------|
|**`cacheKey`**|`{Function(options, request) -> {String}}`|`undefined`|Allows you to override default cache key generator|
|**`cacheDirectory`**|`{String}`|`path.resolve('.cache-loader')`|Provide a cache directory where cache items should be stored (used for default read/write implementation)|
|**`cacheIdentifier`**|`{String}`|`cache-loader:{version} {process.env.NODE_ENV}`|Provide an invalidation identifier which is used to generate the hashes. You can use it for extra dependencies of loaders (used for default read/write implementation)|
|**`write`**|`{Function(cacheKey, data, callback) -> {void}}`|`undefined`|Allows you to override default write cache data to file (e.g. Redis, memcached)|
|**`read`**|`{Function(cacheKey, callback) -> {void}}`|`undefined`|Allows you to override default read cache data from file|

<h2 align="center">Examples</h2>

**webpack.config.js**
```js
module.exports = {
  module: {
    rules: [
      {
        test: /\.js$/,
        use: [
          'cache-loader',
          'babel-loader'
        ],
        include: path.resolve('src')
      }
    ]
  }
}
```

### `Database Integration`

**webpack.config.js**
```js
// Or different database client - memcached, mongodb, ...
const redis = require('redis');
const crypto = require('crypto');

// ...
// connect to client
// ...

const BUILD_CACHE_TIMEOUT = 24 * 3600; // 1 day

function digest(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

// Generate own cache key
function cacheKey(options, request) {
  return `build:cache:${digest(request)}`;
}


// Read data from database and parse them
function read(key, callback) {
  client.get(key, (err, result) => {
    if (err) {
      return callback(err);
    }

    if (!result) {
      return callback(new Error(`Key ${key} not found`));
    }

    try {
      let data = JSON.parse(result);
      callback(null, data);
    } catch (e) {
      callback(e);
    }
  });
}


// Write data to database under cacheKey
function write(key, data, callback) {
  client.set(key, JSON.stringify(data), 'EX', BUILD_CACHE_TIMEOUT, callback);
}

module.exports = {
  module: {
    rules: [
      {
        test: /\.js$/,
        use: [
          {
            loader: 'cache-loader',
            options: {
              cacheKey,
              read,
              write,
            }
          },
          'babel-loader'
        ],
        include: path.resolve('src')
      }
    ]
  }
}
```

<h2 align="center">Maintainers</h2>

<table>
  <tbody>
    <tr>
      <td align="center">
        <a href="https://github.com/sokra">
          <img width="150" height="150" src="https://github.com/sokra.png?size=150">
          </br>
          Tobias Koppers
        </a>
      </td>
      <td align="center">
        <a href="https://github.com/bebraw">
          <img width="150" height="150" src="https://github.com/bebraw.png?v=3&s=150">
          </br>
          Juho Vepsäläinen
        </a>
      </td>
      <td align="center">
        <a href="https://github.com/d3viant0ne">
          <img width="150" height="150" src="https://github.com/d3viant0ne.png?v=3&s=150">
          </br>
          Joshua Wiens
        </a>
      </td>
      <td align="center">
        <a href="https://github.com/michael-ciniawsky">
          <img width="150" height="150" src="https://github.com/michael-ciniawsky.png?v=3&s=150">
          </br>
          Michael Ciniawsky
        </a>
      </td>
      <td align="center">
        <a href="https://github.com/evilebottnawi">
          <img width="150" height="150" src="https://github.com/evilebottnawi.png?v=3&s=150">
          </br>
          Alexander Krasnoyarov
        </a>
      </td>
    </tr>
  <tbody>
</table>


[npm]: https://img.shields.io/npm/v/cache-loader.svg
[npm-url]: https://npmjs.com/package/cache-loader

[node]: https://img.shields.io/node/v/cache-loader.svg
[node-url]: https://nodejs.org

[deps]: https://david-dm.org/webpack-contrib/cache-loader.svg
[deps-url]: https://david-dm.org/webpack-contrib/cache-loader

[chat]: https://img.shields.io/badge/gitter-webpack%2Fwebpack-brightgreen.svg
[chat-url]: https://gitter.im/webpack/webpack

[test]: https://img.shields.io/travis/webpack-contrib/cache-loader.svg
[test-url]: https://travis-ci.org/webpack-contrib/cache-loader

[cover]: https://codecov.io/gh/webpack-contrib/cache-loader/branch/master/graph/badge.svg
[cover-url]: https://codecov.io/gh/webpack-contrib/cache-loader
