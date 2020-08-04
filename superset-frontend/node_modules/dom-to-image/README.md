# DOM to Image

[![Build Status](https://travis-ci.org/tsayen/dom-to-image.svg?branch=master)](https://travis-ci.org/tsayen/dom-to-image)

## What is it

**dom-to-image** is a library which can turn arbitrary DOM node into
a vector (SVG) or raster (PNG or JPEG) image, written in JavaScript. It's
based on [domvas by Paul Bakaus](https://github.com/pbakaus/domvas)
and has been completely rewritten, with some bugs fixed and some new
features (like web font and image support) added.

## Installation

### NPM

`npm install dom-to-image`

Then load

```javascript
/* in ES 6 */
import domtoimage from 'dom-to-image';
/* in ES 5 */
var domtoimage = require('dom-to-image');
```

### Bower

`bower install dom-to-image`

Include either `src/dom-to-image.js` or `dist/dom-to-image.min.js` in your page
and it will make the `domtoimage` variable available in the global scope.

```html
<script src="path/to/dom-to-image.min.js" />
<script>
  domtoimage.toPng(node)
  //...
</script>
```

## Usage

All the top level functions accept DOM node and rendering options,
and return promises, which are fulfilled with corresponding data URLs.  
Get a PNG image base64-encoded data URL and display right away:

```javascript
var node = document.getElementById('my-node');

domtoimage.toPng(node)
    .then(function (dataUrl) {
        var img = new Image();
        img.src = dataUrl;
        document.body.appendChild(img);
    })
    .catch(function (error) {
        console.error('oops, something went wrong!', error);
    });
```

Get a PNG image blob and download it (using [FileSaver](https://github.com/eligrey/FileSaver.js/),
for example):

```javascript
domtoimage.toBlob(document.getElementById('my-node'))
    .then(function (blob) {
        window.saveAs(blob, 'my-node.png');
    });
```

Save and download a compressed JPEG image:

```javascript
domtoimage.toJpeg(document.getElementById('my-node'), { quality: 0.95 })
    .then(function (dataUrl) {
        var link = document.createElement('a');
        link.download = 'my-image-name.jpeg';
        link.href = dataUrl;
        link.click();
    });
```

Get an SVG data URL, but filter out all the `<i>` elements:

```javascript
function filter (node) {
    return (node.tagName !== 'i');
}

domtoimage.toSvg(document.getElementById('my-node'), {filter: filter})
    .then(function (dataUrl) {
        /* do something */
    });
```

Get the raw pixel data as a [Uint8Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)
with every 4 array elements representing the RGBA data of a pixel:

```javascript
var node = document.getElementById('my-node');

domtoimage.toPixelData(node)
    .then(function (pixels) {
        for (var y = 0; y < node.scrollHeight; ++y) {
          for (var x = 0; x < node.scrollWidth; ++x) {
            pixelAtXYOffset = (4 * y * node.scrollHeight) + (4 * x);
            /* pixelAtXY is a Uint8Array[4] containing RGBA values of the pixel at (x, y) in the range 0..255 */
            pixelAtXY = pixels.slice(pixelAtXYOffset, pixelAtXYOffset + 4);
          }
        }
    });
```

* * *

_All the functions under `impl` are not public API and are exposed only
for unit testing._

* * *

### Rendering options

#### filter

A function taking DOM node as argument. Should return true if passed node
should be included in the output (excluding node means excluding it's
children as well). Not called on the root node.

#### bgcolor

A string value for the background color, any valid CSS color value.

#### height, width

Height and width in pixels to be applied to node before rendering.

#### style

An object whose properties to be copied to node's style before rendering.
You might want to check [this reference](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Properties_Reference)
for JavaScript names of CSS properties.

#### quality

A number between 0 and 1 indicating image quality (e.g. 0.92 => 92%) of the
JPEG image. Defaults to 1.0 (100%)

#### cacheBust

Set to true to append the current time as a query string to URL requests to enable cache busting. Defaults to false

#### imagePlaceholder

A data URL for a placeholder image that will be used when fetching an image fails. Defaults to undefined and will throw an error on failed images

## Browsers

It's tested on latest Chrome and Firefox (49 and 45 respectively at the time
of writing), with Chrome performing  significantly better on big DOM trees,
possibly due to it's more performant SVG support, and the fact that it supports
 `CSSStyleDeclaration.cssText` property.  

_Internet Explorer is not (and will not be) supported, as it does not support
SVG `<foreignObject>` tag_  

_Safari [is not supported](https://github.com/tsayen/dom-to-image/issues/27), as it uses a stricter security model on `<foreignObject`> tag. Suggested workaround is to use `toSvg` and render on the server._`

## Dependencies

### Source

Only standard lib is currently used, but make sure your browser supports:  

-   [Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise)  
-   SVG `<foreignObject>` tag

### Tests

Most importantly, tests depend on:

-   [js-imagediff](https://github.com/HumbleSoftware/js-imagediff),
    to compare rendered and control images

-   [ocrad.js](https://github.com/antimatter15/ocrad.js), for the
    parts when you can't compare images (due to the browser
    rendering differences) and just have to test whether the text is rendered

## How it works

There might some day exist (or maybe already exists?) a simple and standard
way of exporting parts of the HTML to image (and then this script can only
serve as an evidence of all the hoops I had to jump through in order to get
such obvious thing done) but I haven't found one so far.  

This library uses a feature of SVG that allows having arbitrary HTML content
inside of the `<foreignObject>` tag. So, in order to render that DOM node
for you, following steps are taken:  

1.  Clone the original DOM node recursively

2.  Compute the style for the node and each sub-node and copy it to
    corresponding clone

    -   and don't forget to recreate pseudo-elements, as they are not
        cloned in any way, of course

3.  Embed web fonts

    -   find all the `@font-face` declarations that might represent web fonts

    -   parse file URLs, download corresponding files

    -   base64-encode and inline content as `data:` URLs

    -   concatenate all the processed CSS rules and put them into one `<style>`
        element, then attach it to the clone

4.  Embed images

    -   embed image URLs in `<img>` elements

    -   inline images used in `background` CSS property, in a fashion similar to
        fonts

5.  Serialize the cloned node to XML

6.  Wrap XML into the `<foreignObject>` tag, then into the SVG, then make it a
    data URL

7.  Optionally, to get PNG content or raw pixel data as a Uint8Array, create an
    Image element with the SVG as a source, and render it on an off-screen
    canvas, that you have also created, then read the content from the canvas

8.  Done!  

## Things to watch out for

-   if the DOM node you want to render includes a `<canvas>` element with
    something drawn on it, it should be handled fine, unless the canvas is
    [tainted](https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_enabled_image) -
    in this case rendering will rather not succeed.  

-   at the time of writing, Firefox has a problem with some external stylesheets
    (see issue #13). In such case, the error will be caught and logged.  

## Authors

Anatolii Saienko, Paul Bakaus (original idea)

## License

MIT
