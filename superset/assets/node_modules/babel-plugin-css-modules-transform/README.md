# babel-plugin-css-modules-transform [![Circle CI](https://circleci.com/gh/michalkvasnicak/babel-plugin-css-modules-transform.svg?style=svg)](https://circleci.com/gh/michalkvasnicak/babel-plugin-css-modules-transform)

**🎉 Babel 6 and Babel 7 compatible**

**⚠️ Babel 7 compatibility added in 1.4.0**

This Babel plugin finds all `require`s for css module files and replace them with a hash where keys are class names and values are generated css class names.

This plugin is based on the fantastic [css-modules-require-hook](https://github.com/css-modules/css-modules-require-hook).

## Warning

This plugin is experimental, pull requests are welcome.

**Do not run this plugin as part of webpack frontend configuration. This plugin is intended only for backend compilation.**

## Example

```css
/* test.css */

.someClass {
    color: red;
}
```

```js
// component.js
const styles = require('./test.css');

console.log(styles.someClass);

// transformed file
const styles = {
    'someClass': 'Test__someClass___2Frqu'
}

console.log(styles.someClass); // prints Test__someClass___2Frqu
```

## Installation

```console
npm install --save-dev babel-plugin-css-modules-transform
```

**Include plugin in `.babelrc`**

```json
{
    "plugins": ["css-modules-transform"]
}
```

**With custom options [css-modules-require-hook options](https://github.com/css-modules/css-modules-require-hook#tuning-options)**


```js
{
    "plugins": [
        [
            "css-modules-transform", {
                "append": [
                    "npm-module-name",
                    "./path/to/module-exporting-a-function.js"
                ],
                "camelCase": false,
                "createImportedName": "npm-module-name",
                "createImportedName": "./path/to/module-exporting-a-function.js",
                "devMode": false,
                "extensions": [".css", ".scss", ".less"], // list extensions to process; defaults to .css
                "generateScopedName": "[name]__[local]___[hash:base64:5]", // in case you don't want to use a function
                "generateScopedName": "./path/to/module-exporting-a-function.js", // in case you want to use a function
                "generateScopedName": "npm-module-name",
                "hashPrefix": "string",
                "ignore": "*css",
                "ignore": "./path/to/module-exporting-a-function-or-regexp.js",
                "preprocessCss": "./path/to/module-exporting-a-function.js",
                "preprocessCss": "npm-module-name",
                "processCss": "./path/to/module-exporting-a-function.js",
                "processCss": "npm-module-name",
                "processorOpts": "npm-module-name",
                "processorOpts": "./path/to/module/exporting-a-plain-object.js",
                "mode": "string",
                "prepend": [
                    "npm-module-name",
                    "./path/to/module-exporting-a-function.js"
                ],
                "extractCss": "./dist/stylesheets/combined.css"
            }
        ]
    ]
}
```

## Using a preprocessor

When using this plugin with a preprocessor, you'll need to configure it as such:


```js
// ./path/to/module-exporting-a-function.js
var sass = require('node-sass');
var path = require('path');

module.exports = function processSass(data, filename) {
    var result;
    result = sass.renderSync({
        data: data,
        file: filename
    }).css;
    return result.toString('utf8');
};
```

and then add any relevant extensions to your plugin config:

```js
{
    "plugins": [
        [
            "css-modules-transform", {
                "preprocessCss": "./path/to/module-exporting-a-function.js",
                "extensions": [".css", ".scss"]
            }
        ]
    ]
}

```

## Extract CSS Files

When you publish a library, you might want to ship compiled css files as well to
help integration in other projects.

An more complete alternative is to use
[babel-plugin-webpack-loaders](https://github.com/istarkov/babel-plugin-webpack-loaders)
but be aware that a new webpack instance is run for each css file, this has a
huge overhead. If you do not use fancy stuff, you might consider using
[babel-plugin-css-modules-transform](https://github.com/michalkvasnicak/babel-plugin-css-modules-transform)
instead.


To combine all css files in a single file, give its name:

```js
{
    "plugins": [
        [
            "css-modules-transform", {
                "extractCss": "./dist/stylesheets/combined.css"
            }
        ]
    ]
}
```

To extract all files in a single directory, give an object:

```js
{
    "plugins": [
        [
            "css-modules-transform", {
                "extractCss": {
                    "dir": "./dist/stylesheets/",
                    "relativeRoot": "./src/",
                    "filename": "[path]/[name].css"
                }
            }
        ]
    ]
}
```

Note that `relativeRoot` is used to resolve relative directory names, available
as `[path]` in `filename` pattern.

## Keeping import

To keep import statements you should set option `keepImport` to *true*. In this way, simultaneously with the converted values, the import will be described as unassigned call expression.

```js
// before
const styles = require('./test.css');
```

```js
// after
require('./test.css');

const styles = {
    'someClass': 'Test__someClass___2Frqu'
}
```

## Alternatives

- [babel-plugin-transform-postcss](https://github.com/wbyoung/babel-plugin-transform-postcss) - which supports async plugins and does not depend on `css-modules-require-hook`.

## License

MIT
