# esm

A fast, production ready, zero-dependency ES module loader for Node 6+!

See the release [post](https://medium.com/web-on-the-edge/tomorrows-es-modules-today-c53d29ac448c)
and [video](https://www.youtube.com/watch?v=JcZ-FzfDq8A#t=5) for all the details.

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

The `esm` loader bridges the ESM of [today](https://babeljs.io/) to the
ESM of [tomorrow](https://github.com/nodejs/modules).

:clap: By default, :100: percent CJS interoperability is enabled so you can get stuff done fast.<br>
:lock: `.mjs` files are limited to basic functionality without support for `esm` options.

Out of the box `esm` just works, no configuration necessary, and supports:

* [`import`](https://ponyfoo.com/articles/es6-modules-in-depth#import)/[`export`](https://ponyfoo.com/articles/es6-modules-in-depth#export)
* [`import.meta`](https://github.com/tc39/proposal-import-meta)
* [Dynamic `import`](https://github.com/tc39/proposal-dynamic-import)
* [Improved errors](https://github.com/standard-things/esm/wiki/improved-errors)
* [Live bindings](https://ponyfoo.com/articles/es6-modules-in-depth#bindings-not-values)
* [Loading `.mjs` files as ESM](https://github.com/nodejs/node-eps/blob/master/002-es-modules.md#32-determining-if-source-is-an-es-module)
* [The file URI scheme](https://en.wikipedia.org/wiki/File_URI_scheme)
* Node [`--eval`](https://nodejs.org/api/cli.html#cli_e_eval_script) and [`--print`](https://nodejs.org/api/cli.html#cli_p_print_script) flags
* Node [`--check`](https://nodejs.org/api/cli.html#cli_c_check) flag _(Node 10+)_

Options
---

Specify options with one of the following:

* The `"esm"` field in `package.json`
* CJS/ESM in an `.esmrc.js` or `.esmrc.mjs` file
* [JSON6](https://github.com/d3x0r/json6) in an `.esmrc` or `.esmrc.json` file
* JSON6 or file path in the `ESM_OPTIONS` environment variable
* The `ESM_DISABLE_CACHE` environment variable

<table><tr><td colspan=2><code>{</code><tr><td valign=top><code>"await":</code><td><p>A boolean for top-level <a href=https://node.green/#ES2017-features-async-functions-await><code>await</code></a> in modules <a href=https://github.com/mylesborins/proposal-top-level-await/#optional-constraint-top-level-await-can-only-be-used-in-modules-without-exports>without ESM exports</a>.<tr><td valign=top><code>"cjs":</code><td><p>A boolean or object for toggling CJS features in ESM.<details><summary>Features</summary><table><tr><td colspan=2><code>{</code><tr><td valign=top><code>"cache":</code><td><p>A boolean for storing ES modules in <code>require.cache</code>.<tr><td valign=top><code>"extensions":</code><td><p>A boolean for respecting <code>require.extensions</code> in ESM.<tr><td valign=top><code>"interop":</code><td><p>A boolean for <code>__esModule</code> interoperability.<tr><td valign=top><code>"mutableNamespace":</code><td><p>A boolean for mutable <a href=https://ponyfoo.com/articles/es6-modules-in-depth#import-all-the-things>namespace objects</a>.<tr><td valign=top><code>"namedExports":</code><td><p>A boolean for <a href=https://ponyfoo.com/articles/es6-modules-in-depth#importing-named-exports>importing named exports</a> of CJS modules.<tr><td valign=top><code>"paths":</code><td><p>A boolean for following CJS <a href=https://github.com/nodejs/node-eps/blob/master/002-es-modules.md#432-removal-of-non-local-dependencies>path rules</a> in ESM.<tr><td valign=top><code>"vars":</code><td><p>A boolean for <code>__dirname</code>, <code>__filename</code>, and <code>require</code> in ESM.<tr><td colspan=2><code>}</code></table></details><tr><td valign=top><code>"force":</code><td><p>A boolean to apply these options to all module loads.<tr><td valign=top><code>"mainFields":</code><td><p>An array of fields, e.g. <code>["main"]</code>, checked when importing a package.<tr><td valign=top><code>"mode":</code><td><p>A string mode:<ul><li><code>"auto"</code> detect files with <code>import</code>, <code>import.meta</code>, <code>export</code>,<br><a href=https://github.com/tc39/proposal-modules-pragma><code>"use module"</code></a>, or <code>.mjs</code> as ESM<li><code>"all"</code> script files are treated as ESM<li><code>"strict"</code> to treat <strong>only</strong> <code>.mjs</code> files as ESM</ul><tr><td colspan=2><code>}</code></table>

DevOpts
---

<table><tr><td colspan=2><code>{</code><tr><td valign=top><code>"cache":</code><td><p>A boolean for toggling cache creation or cache directory path.<tr><td valign=top><code>"sourceMap":</code><td><p>A boolean for including inline source maps.<tr><td colspan=2><code>}</code></table>

Tips
---

### Bundling

* Add a “module” field to `package.json` with the path to the main ES module.

  :bulb: This is automagically done with `npm init esm` or `yarn create esm`.

* Use [`esmify`](https://github.com/mattdesl/esmify) with [`browserify`](http://browserify.org/).

### Extensions

* Enable ESM syntax for [`wallaby.js`](https://wallabyjs.com/) following their
  [integration example](https://wallabyjs.com/docs/integration/node.html#es-modules).

### Loading

* The [`jasmine`](https://jasmine.github.io/) test runner does not have a
  mechanism to load `esm`. However, `esm` can load a bootstrap file that
  programmaticly runs tests following their
  [library usage example](https://jasmine.github.io/setup/nodejs.html#a-simple-example-using-the-library).

* Load `esm` before loaders/monitors like
  [`@babel/register`](https://babeljs.io/docs/en/next/babel-register.html),
  [`newrelic`](https://github.com/newrelic/node-newrelic),
  [`sqreen`](https://docs.sqreen.io/sqreen-for-nodejs/getting-started-2/), and
  [`ts-node`](https://github.com/TypeStrong/ts-node#programmatic).

* Load `esm` with the “node-args” options of<br>
  - [`node-tap`](https://www.node-tap.org/cli/): `--node-arg=-r --node-arg=esm`
  - [`pm2`](https://pm2.io/doc/en/runtime/reference/pm2-cli/#pm2-flags): `--node-args="-r esm"`

* Load `esm` with “require” options of
  [`ava`](https://github.com/avajs/ava/blob/master/docs/recipes/es-modules.md),
  [`mocha`](https://mochajs.org/#-r---require-module-name),
  [`nodemon`](https://nodemon.io/),
  [`nyc`](https://github.com/istanbuljs/nyc#require-additional-modules),
  [`qunit`](https://github.com/qunitjs/qunit/releases/tag/2.6.0),
  [`tape`](https://github.com/substack/tape#preloading-modules), and
  [`webpack`](https://webpack.js.org/api/cli/#config-options).

  :bulb: By Node’s rules, builtin `require` cannot sideload `.mjs` files.
  However, with `esm`, ES modules can be sideloaded as `.js` files or `.mjs`
  files may be loaded with dynamic `import`.
