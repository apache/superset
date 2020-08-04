# TinySDF

TinySDF is a tiny and fast JavaScript library for generating SDF (signed distance field)
from system fonts on the browser using Canvas 2D and
[Felzenszwalb/Huttenlocher distance transform](https://cs.brown.edu/~pff/papers/dt-final.pdf).
This is very useful for [rendering text with WebGL](https://www.mapbox.com/blog/text-signed-distance-fields/).

This implementation is based directly on the algorithm published in the Felzenszwalb/Huttenlocher paper, and is not a port of the existing C++ implementation provided by the paper's authors. 

Demo: http://mapbox.github.io/tiny-sdf/

## Usage
Create a TinySDF for drawing SDFs based on font parameters:

```js
var fontsize = 24; // Font size in pixels
var buffer = 3;    // Whitespace buffer around a glyph in pixels
var radius = 8;    // How many pixels around the glyph shape to use for encoding distance
var cutoff = 0.25  // How much of the radius (relative) is used for the inside part the glyph

var fontFamily = 'sans-serif'; // css font-family
var fontWeight = 'normal';     // css font-weight
var tinySDFGenerator = new TinySDF(fontsize, buffer, radius, cutoff, fontFamily, fontWeight);

var oneSDF = tinySDFGenerator.draw('泽');
// returns a Uint8ClampedArray array of alpha values (0–255) for a size x size square grid
```
