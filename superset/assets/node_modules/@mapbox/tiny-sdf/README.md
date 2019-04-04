# TinySDF

TinySDF is a tiny and fast JavaScript library for generating SDF (signed distance field)
from system fonts on the browser using Canvas 2D and
[Felzenszwalb/Huttenlocher distance transform](https://cs.brown.edu/~pff/dt/).
This is very useful for [rendering text with WebGL](https://www.mapbox.com/blog/text-signed-distance-fields/).

Demo: http://mapbox.github.io/tiny-sdf/

## Usage
Create a TinySDF for drawing SDFs based on font parameters:

    var fontsize = 24; // Pixel font size
    var buffer = 3;    // Pixel whitespace buffer around glyph
    var radius = 8;    // Lower = "sharper", higher = "fuzzier"
    var cutoff = 0.25  // Across the board alpha channel reduction
                       // Reduces low-alpha pixels to zero, "thins" SDF overall

    var fontFamily = 'sans-serif'; // css font-family
    var fontWeight = 'normal';     // css font-weight
    var tinySDFGenerator = new TinySDF(fontsize,
                                       buffer,
                                       radius,
                                       cutoff,
                                       fontFamily,
                                       fontWeight);

    var oneSDF = tinySDFGenerator.draw('泽');
