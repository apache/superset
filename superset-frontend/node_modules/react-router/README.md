# react-router

Declarative routing for [React](https://facebook.github.io/react).

## Installation

Using [npm](https://www.npmjs.com/):

    $ npm install --save react-router

**Note:** This package provides the core routing functionality for React Router, but you might not want to install it directly. If you are writing an application that will run in the browser, you should instead install `react-router-dom`. Similarly, if you are writing a React Native application, you should instead install `react-router-native`. Both of those will install `react-router` as a dependency.

Then with a module bundler like [webpack](https://webpack.github.io/), use as you would anything else:

```js
// using ES6 modules
import { Router, Route, Switch } from "react-router";

// using CommonJS modules
var Router = require("react-router").Router;
var Route = require("react-router").Route;
var Switch = require("react-router").Switch;
```

The UMD build is also available on [unpkg](https://unpkg.com):

```html
<script src="https://unpkg.com/react-router/umd/react-router.min.js"></script>
```

You can find the library on `window.ReactRouter`.

## Issues

If you find a bug, please file an issue on [our issue tracker on GitHub](https://github.com/ReactTraining/react-router/issues).

## Credits

React Router is built and maintained by [React Training](https://reacttraining.com).
