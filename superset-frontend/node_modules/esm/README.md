# esm

The brilliantly simple, babel-less, bundle-less ECMAScript module loader.

> `esm` is the world’s most advanced ECMAScript module loader.
This fast, production ready, zero dependency loader is all you need to support
ECMAScript modules in Node 6+. See the release [post](https://medium.com/web-on-the-edge/tomorrows-es-modules-today-c53d29ac448c)
and [video](https://www.youtube.com/watch?v=JcZ-FzfDq8A#t=5) for details!

Install
---

* __New projects__

  Run `npm init esm` or `yarn create esm`.

  :bulb: Use the `-y` flag to answer “yes” to all prompts.

* __Existing projects__

  Run `npm i esm` or `yarn add esm`.

Getting started
---

There are two ways to enable `esm`.

1. Enable `esm` for packages:

   Use `esm` to load the main ES module and export it as CommonJS.

    __index.js__
    ```js
    // Set options as a parameter, environment variable, or rc file.
    require = require("esm")(module/*, options*/)
    module.exports = require("./main.js")
    ```
    __main.js__
    ```js
    // ESM syntax is supported.
    export {}
    ```
    :bulb: These files are automagically created with `npm init esm` or `yarn create esm`.

2. Enable `esm` for local runs:

    ```shell
    node -r esm main.js
    ```
    :bulb: Omit the filename to enable `esm` in the REPL.

Features
---

:clap: By default, :100: percent CJS interoperability is enabled so you can get stuff done.<br>
:lock: `.mjs` files are limited to basic functionality without support for `esm` options.

Out of the box `esm` just works, no configuration necessary, and supports:

* Passing all applicable [test262](https://github.com/tc39/test262) compliance tests
* [`import`](https://ponyfoo.com/articles/es6-modules-in-depth#import)/[`export`](https://ponyfoo.com/articles/es6-modules-in-depth#export)
* [`import.meta`](https://github.com/tc39/proposal-import-meta)
* [Dynamic `import`](https://github.com/tc39/proposal-dynamic-import)
* [Live bindings](https://ponyfoo.com/articles/es6-modules-in-depth#bindings-not-values)
* [File URI scheme](https://en.wikipedia.org/wiki/File_URI_scheme)
* Node `stdin`, [`--eval`](https://nodejs.org/api/cli.html#cli_e_eval_script), [`--print`](https://nodejs.org/api/cli.html#cli_p_print_script) flags
* Node [`--check`](https://nodejs.org/api/cli.html#cli_c_check) flag _(Node 10+)_

Options
---

Specify options with one of the following:

* `"esm"` field in `package.json`
* CJS/ESM in an `.esmrc.js`, `.esmrc.cjs`, or `.esmrc.mjs` file
* [JSON6](https://github.com/d3x0r/json6) in an `.esmrc` or `.esmrc.json` file
* JSON6 or file path in the `ESM_OPTIONS` environment variable
* `ESM_DISABLE_CACHE` environment variable

<table><tr><td colspan=2><code>{</code><tr><td valign=top><code>"cjs":true</code><td><p>A boolean or object for toggling CJS features in ESM.<details><summary>Features</summary><table><tr><td colspan=2><code>{</code><tr><td valign=top><code>"cache":true</code><td><p>A boolean for storing ES modules in <code>require.cache</code>.<tr><td valign=top><code>"esModule":true</code><td><p>A boolean for <code>__esModule</code> interoperability.<tr><td valign=top><code>"extensions":true</code><td><p>A boolean for respecting <code>require.extensions</code> in ESM.<tr><td valign=top><code>"mutableNamespace":true</code><td><p>A boolean for mutable <a href=https://ponyfoo.com/articles/es6-modules-in-depth#import-all-the-things>namespace objects</a>.<tr><td valign=top><code>"namedExports":true</code><td><p>A boolean for <a href=https://ponyfoo.com/articles/es6-modules-in-depth#importing-named-exports>importing named exports</a> of CJS modules.<tr><td valign=top><code>"paths":true</code><td><p>A boolean for following CJS <a href=https://github.com/nodejs/node-eps/blob/master/002-es-modules.md#432-removal-of-non-local-dependencies>path rules</a> in ESM.<tr><td valign=top><code>"vars":true</code><td><p>A boolean for <code>__dirname</code>, <code>__filename</code>, and <code>require</code> in ESM.<tr><td valign=top><code>"dedefault":false</code><td><p>A boolean for requiring ES modules without the dangling <code>require().default</code>.<tr><td valign=top><code>"topLevelReturn":false</code><td><p>A boolean for top-level <code>return</code> support.<tr><td colspan=2><code>}</code></table></details><tr><td valign=top><code>"mainFields":["main"]</code><td><p>An array of fields checked when importing a package.<tr><td valign=top><code>"mode":"auto"</code><td><p>A string mode:<ul><li><code>"auto"</code> detect files with <code>import</code>, <code>import.meta</code>, <code>export</code>,<br><a href=https://github.com/tc39/proposal-modules-pragma><code>"use module"</code></a>, or <code>.mjs</code> as ESM.<li><code>"all"</code> files besides those with <code>"use script"</code> or <code>.cjs</code> are treated as ESM.<li><code>"strict"</code> to treat <strong>only</strong> <code>.mjs</code> files as ESM.</ul><tr><td valign=top><code>"await":false</code><td><p>A boolean for <a href=https://github.com/tc39/proposal-top-level-await>top-level <code>await</code></a> in modules without ESM exports. <em>(Node 10+)</em><tr><td valign=top><code>"force":false</code><td><p>A boolean to apply these options to all module loads.<tr><td valign=top><code>"wasm":false</code><td><p>A boolean for <a href=https://nodejs.org/api/globals.html#globals_webassembly>WebAssembly</a> module support. <em>(Node 8+)</em><tr><td colspan=2><code>}</code></table>

DevOpts
---

<table><tr><td colspan=2><code>{</code><tr><td valign=top><code>"cache":true</code><td><p>A boolean for toggling cache creation or a cache directory path.<tr><td valign=top><code>"sourceMap":false</code><td><p>A boolean for including inline source maps.<tr><td colspan=2><code>}</code></table>

Tips
---

### Bundling

* For bundlers like [`browserify`](http://browserify.org/)+[`esmify`](https://github.com/mattdesl/esmify),
  [`parcel-bundler`](https://parceljs.org/), and [`webpack`](https://webpack.js.org/)
  add a `"module"` field to `package.json` pointing to the main ES module.
  ```json
  "main": "index.js",
  "module": "main.js"
  ```

  :bulb: This is automagically done with `npm init esm` or `yarn create esm`.

### Extensions

* Enable `esm` for [`wallaby.js`](https://wallabyjs.com/) following their
  [integration example](https://wallabyjs.com/docs/integration/node.html#es-modules).

### Loading

* Load `esm` before loaders/monitors like
  [`@babel/register`](https://babeljs.io/docs/en/next/babel-register.html),
  [`newrelic`](https://github.com/newrelic/node-newrelic),
  [`sqreen`](https://docs.sqreen.io/sqreen-for-nodejs/getting-started-2/), and
  [`ts-node`](https://github.com/TypeStrong/ts-node#programmatic).

* Load `esm` for [`jasmine`](https://jasmine.github.io/) using the
  [`"helpers"`](https://jasmine.github.io/setup/nodejs.html#configuration)
  field in `jasmine.json`:
  ```json
  "helpers": [
    "node_modules/esm"
  ]
  ```

* Load `esm` with “node-args" options of:<br>
  - [`pm2`](https://pm2.io/doc/en/runtime/reference/pm2-cli/#pm2-flags): `--node-args="-r esm"`

* Load `esm` with “require” options of
  [`ava`](https://github.com/avajs/ava/blob/master/docs/recipes/es-modules.md),
  [`mocha`](https://mochajs.org/#-require-module-r-module),
  [`nodemon`](https://nodemon.io/),
  [`nyc`](https://github.com/istanbuljs/nyc#require-additional-modules),
  [`qunit`](https://github.com/qunitjs/qunit/releases/tag/2.6.0),
  [`tape`](https://github.com/substack/tape#preloading-modules), and
  [`webpack`](https://webpack.js.org/api/cli/#config-options).

  :bulb: Builtin `require` cannot sideload `.mjs` files. However, `.js` files
  can be sideloaded or `.mjs` files may be loaded with dynamic `import`.
