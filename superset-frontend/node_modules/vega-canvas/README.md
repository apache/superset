# vega-canvas

[Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API) and [Image](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/Image)  object instantiation utilities. Creates an [HTML5 Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API), using either the web browser DOM or a [node-canvas](https://github.com/Automattic/node-canvas) library.

This package attempts three forms of canvas creation, in this order:

- If in a browser environment, use DOM methods to create a new canvas.
- If the [node-canvas](https://github.com/Automattic/node-canvas) library is present, use that.
- Otherwise, return `null`.

To ensure error-free build processes for client-side code, this module does not include any direct or optional dependencies on the [node-canvas](https://github.com/Automattic/node-canvas) library. Projects that use this pacakge and require canvas support for server-side (node.js) operations *must include a canvas dependency in their own `package.json` file*.

## API Reference

<a name="canvas" href="#canvas">#</a>
vega.<b>canvas</b>([<i>width</i>, <i>height</i>, <i>type</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-canvas/index.js "Source")

Creates a new [Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API) instance, with an optional *width* and *height* (in pixels). If *width* and *height* are omitted, creates a _0 x 0_ canvas. The optional *type* parameter is a [node-canvas type parameter](https://github.com/Automattic/node-canvas#createcanvas) to enable PDF or SVG output modes; this parameter is applied only if node-canvas is used. This method first attempts to create a canvas using the DOM `document.createElement` method. If that fails, the method then attempts to instantiate a canvas using the [node-canvas](https://github.com/Automattic/node-canvas) library. If that also fails, returns `null`.

<a name="domCanvas" href="#domCanvas">#</a>
vega.<b>domCanvas</b>([<i>width</i>, <i>height</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-canvas/src/domCanvas.js "Source")

Creates a new [Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API) instance, with an optional *width* and *height* (in pixels). If *width* and *height* are omitted, creates a _0 x 0_ canvas. This method first attempts to create a canvas using the DOM `document.createElement` method. If that fails, returns `null`.

<a name="nodeCanvas" href="#nodeCanvas">#</a>
vega.<b>nodeCanvas</b>([<i>width</i>, <i>height</i>, <i>type</i>])
[<>](https://github.com/vega/vega/blob/master/packages/vega-canvas/src/nodeCanvas.js "Source")

Creates a new [Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API) instance, with an optional *width* and *height* (in pixels). If *width* and *height* are omitted, creates a _0 x 0_ canvas. The optional *type* parameter is a [node-canvas type parameter](https://github.com/Automattic/node-canvas#createcanvas) to enable PDF or SVG output modes.  This method attempts to instantiate a canvas using using the [node-canvas](https://github.com/Automattic/node-canvas) library. If that fails, returns `null`. This method is not exported in browser-only builds.

<a name="image" href="#image">#</a>
vega.<b>image</b>()
[<>](https://github.com/vega/vega/blob/master/packages/vega-canvas/index.js "Source")

Returns a reference to the [Image](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/Image) constructor. In a web browser environment, simply returns the built-in `Image` object. Otherwise, attempts to return the `Image` instance exported by a node canvas library. If all attempts to find a canvas library fail, returns `null`.
