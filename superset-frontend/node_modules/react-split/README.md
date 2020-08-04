# React-Split &nbsp; [![CI](https://img.shields.io/circleci/project/github/nathancahill/split/master.svg)](https://circleci.com/gh/nathancahill/split) ![Dependencies](https://david-dm.org/nathancahill/split/status.svg) ![](https://img.badgesize.io/https://unpkg.com/react-split/dist/react-split.min.js?compression=gzip&label=size&v=2.0.4)

React component for [Split.js](https://github.com/nathancahill/Split.js/)

## Installation

Yarn:

```
$ yarn add react-split
```

npm:

```
$ npm install --save react-split
```

Include with a module bundler like [rollup](http://rollupjs.org/) or [webpack](https://webpack.github.io/):

```js
// using ES6 modules
import Split from 'react-split'

// using CommonJS modules
var Split = require('react-split')
```

The [UMD](https://github.com/umdjs/umd) build is also available on [unpkg](http://unpkg.com/):

```html
<script src="https://unpkg.com/react-split/dist/react-split.js"></script>
```

You can find the library on `window.ReactSplit`.

## Usage

The `<Split />` component wraps multiple children components to create a resizeable split view. The component is a
light wraper around the [Split.js](https://github.com/nathancahill/Split.js/) library and accepts (mostly) the same options.

```js
import Split from 'react-split'

<Split>
    <ComponentA />
    <ComponentB />
</Split>
```

## Documentation

Refer to [Split.js documentation](https://github.com/nathancahill/Split.js/#documentation) for the options the component accepts as props. The differences are noted below:

A few props are exempt from updating. These props are functions, given the difficulty of comparing function objects,
these props will not trigger a `componentDidUpdate`.
Follow React best practices, and do not create functions in the render method. Instead, create them once and pass them as props.

-   `gutter`
-   `elementStyle`
-   `gutterStyle`
-   `onDrag`
-   `onDragStart`
-   `onDragEnd`

#### API

-   `.setSizes(sizes)` becomes the prop `sizes={sizes}`
-   `.getSizes()` is unavailable, but sizes are passed to `onDragStart` and `onDragEnd`
-   `.collapse(index)` becomes the prop: `collapsed={index}`
-   `.destroy()` is triggered automatically on `componentWillUnmount`

## License

Copyright (c) 2018 Nathan Cahill

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
