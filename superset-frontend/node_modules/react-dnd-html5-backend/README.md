[![npm package](https://img.shields.io/npm/v/react-dnd-html5-backend.svg?style=flat-square)](https://www.npmjs.org/package/react-dnd-html5-backend)
[![Build Status](https://travis-ci.org/react-dnd/react-dnd-html5-backend.svg?branch=master)](https://travis-ci.org/react-dnd/react-dnd-html5-backend)
[![dependencies Status](https://david-dm.org/react-dnd/react-dnd-html5-backend/status.svg)](https://david-dm.org/react-dnd/react-dnd-html5-backend)
[![devDependencies Status](https://david-dm.org/react-dnd/react-dnd-html5-backend/dev-status.svg)](https://david-dm.org/react-dnd/react-dnd-html5-backend?type=dev)
[![peerDependencies Status](https://david-dm.org/react-dnd/react-dnd-html5-backend/peer-status.svg)](https://david-dm.org/react-dnd/react-dnd-html5-backend?type=peer)

# React DnD HTML5 Backend

The officially supported HTML5 backend for [React DnD](http://react-dnd.github.io/react-dnd/).
See [the docs](http://react-dnd.github.io/react-dnd/docs-html5-backend.html) for usage information.

## Installation

If you use [npm](http://npmjs.com):

```
npm install --save react-dnd-html5-backend
```

The npm package defaults to the CommonJS build.

However it also includes a pre-minified UMD build in the `dist` folder.
The UMD build exports a global `window.ReactDnDHTML5Backend` when imported as a `<script>` tag.

If you’d rather not use npm, you can use [unpkg](http://unpkg.com/) to access the UMD build directly: [ReactDnDHTML5Backend.min.js](https://unpkg.com/react-dnd-html5-backend@latest/dist/ReactDnDHTML5Backend.min.js).
You may point your Bower config to it.

## Browser Support

We strive to support the evergreen browsers, Safari 7+, as well as IE11+. IE10 should also work, but `DragLayer` is fairly useless because IE10 doesn’t support `pointer-events: none`. We don’t officially support IE9 and less.

Unfortunately the browser bugs, inconsistencies, and regressions come up from time to time, so please make sure you test your app on the browsers you’re interested in, and report any bugs to us.

## License

MIT
