# Word Cloud Layout

This is a [Wordle](http://www.wordle.net/)-inspired word cloud layout written
in JavaScript. It uses HTML5 canvas and sprite masks to achieve
near-interactive speeds.

See [here](http://www.jasondavies.com/wordcloud/) for an interactive
demonstration along with implementation details.

![Example cloud of Twitter search results for “amazing”](http://www.jasondavies.com/wordcloud/amazing.png)

## Usage

See the samples in `examples/`.

## API Reference

<a name="cloud" href="#cloud">#</a> d3.layout.<b>cloud</b>()

Constructs a new cloud layout instance.

<a name="on" href="#on">#</a> <b>on</b>(<i>type</i>, <i>listener</i>)

Registers the specified *listener* to receive events of the specified *type*
from the layout. Currently, only "word" and "end" events are supported.

A "word" event is dispatched every time a word is successfully placed.
Registered listeners are called with a single argument: the word object that
has been placed.

An "end" event is dispatched when the layout has finished attempting to place
all words.  Registered listeners are called with two arguments: an array of the
word objects that were successfully placed, and a *bounds* object of the form
`[{x0, y0}, {x1, y1}]` representing the extent of the placed objects.

<a name="start" href="#start">#</a> <b>start</b>()

Starts the layout algorithm.  This initialises various attributes on the word
objects, and attempts to place each word, starting with the largest word.
Starting with the centre of the rectangular area, each word is tested for
collisions with all previously-placed words.  If a collision is found, it tries
to place the word in a new position along the spiral.

**Note:** if a word cannot be placed in any of the positions attempted along
the spiral, it is **not included** in the final word layout.  This may be
addressed in a future release.

<a name="stop" href="#stop">#</a> <b>stop</b>()

Stops the layout algorithm.

<a name="timeInterval" href="#timeInterval">#</a> <b>timeInterval</b>([<i>time</i>])

Internally, the layout uses `setInterval` to avoid locking up the browser’s
event loop.  If specified, **time** is the maximum amount of time that can be
spent during the current timestep.  If not specified, returns the current
maximum time interval, which defaults to `Infinity`.

<a name="words" href="#words">#</a> <b>words</b>([<i>words</i>])

If specified, sets the **words** array.  If not specified, returns the current
words array, which defaults to `[]`.

<a name="size" href="#size">#</a> <b>size</b>([<i>size</i>])

If specified, sets the rectangular `[width, height]` of the layout.  If not
specified, returns the current size, which defaults to `[1, 1]`.

<a name="font" href="#font">#</a> <b>font</b>([<i>font</i>])

If specified, sets the **font** accessor function, which indicates the font
face for each word.  If not specified, returns the current font accessor
function, which defaults to `"serif"`.
A constant may be specified instead of a function.

<a name="fontStyle" href="#fontStyle">#</a> <b>fontStyle</b>([<i>fontStyle</i>])

If specified, sets the **fontStyle** accessor function, which indicates the
font style for each word.  If not specified, returns the current fontStyle
accessor function, which defaults to `"normal"`.
A constant may be specified instead of a function.

<a name="fontWeight" href="#fontWeight">#</a> <b>fontWeight</b>([<i>fontWeight</i>])

If specified, sets the **fontWeight** accessor function, which indicates the
font weight for each word.  If not specified, returns the current fontWeight
accessor function, which defaults to `"normal"`.
A constant may be specified instead of a function.

<a name="fontSize" href="#fontSize">#</a> <b>fontSize</b>([<i>fontSize</i>])

If specified, sets the **fontSize** accessor function, which indicates the
numerical font size for each word.  If not specified, returns the current
fontSize accessor function, which defaults to:

```js
function(d) { return Math.sqrt(d.value); }
```

A constant may be specified instead of a function.

<a name="rotate" href="#rotate">#</a> <b>rotate</b>([<i>rotate</i>])

If specified, sets the **rotate** accessor function, which indicates the
rotation angle (in degrees) for each word.  If not specified, returns the
current rotate accessor function, which defaults to:

```js
function() { return (~~(Math.random() * 6) - 3) * 30; }
```

A constant may be specified instead of a function.

<a name="text" href="#text">#</a> <b>text</b>([<i>text</i>])

If specified, sets the **text** accessor function, which indicates the text for
each word.  If not specified, returns the current text accessor function, which
defaults to:

```js
function(d) { return d.text; }
```

A constant may be specified instead of a function.

<a name="spiral" href="#spiral">#</a> <b>spiral</b>([<i>spiral</i>])

If specified, sets the current type of spiral used for positioning words.  This
can either be one of the two built-in spirals, "archimedean" and "rectangular",
or an arbitrary spiral generator can be used, of the following form:

```js
// size is the [width, height] array specified in cloud.size
function(size) {
  // t indicates the current step along the spiral; it may monotonically
  // increase or decrease indicating clockwise or counterclockwise motion.
  return function(t) { return [x, y]; };
}
```

If not specified, returns the current spiral generator, which defaults to the
built-in "archimedean" spiral.

<a name="padding" href="#padding">#</a> <b>padding</b>([<i>padding</i>])

If specified, sets the **padding** accessor function, which indicates the
numerical padding for each word.  If not specified, returns the current
padding, which defaults to 1.

<a name="random" href="#random">#</a> <b>random</b>([<i>random</i>])

If specified, sets the internal random number generator, used for selecting the
initial position of each word, and the clockwise/counterclockwise direction of
the spiral for each word.  This should return a number in the range `[0, 1)`.

If not specified, returns the current random number generator, which defaults
to `Math.random`.

<a name="canvas" href="#canvas">#</a> <b>canvas</b>([<i>canvas</i>])

If specified, sets the **canvas** generator function, which is used internally
to draw text.  If not specified, returns the current generator function, which
defaults to:

```js
function() { return document.createElement("canvas"); }
```

When using Node.js, you will almost definitely override this default, e.g.
using the [canvas module](https://www.npmjs.com/package/canvas).
