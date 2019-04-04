# @vx/pattern

```
npm install --save @vx/pattern
```

Inspired by: http://riccardoscalco.github.io/textures/

## Example

``` js
import { AreaClosed } from '@vx/shape';
import { PatternLines } from '@vx/pattern';

const PatternArea = () => {
    return (
      <svg>
        <PatternLines
          id="lines"
          height={5}
          width={5}
          stroke={'black'}
          strokeWidth={1}
          orientation={['diagonal']}
        />
        <AreaClosed fill="url('#lines')" />
      </svg>
    );
};
```

## The Definition Caveat

Like gradients, patterns are "defined." When you put down a `<PatternXYZ />`, it's putting a [`<pattern/>`](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Patterns) attribute in the SVG.

It's often better to think of these as variable definitions rather than true DOM elements. When you use `fill="url('#pattern')"` you're referencing the pattern's id: `pattern`.


## Pre-Made Patterns

### `PatternsCircles`

![circles example](http://i.imgur.com/jd9YGJi.png)

``` js
<PatternCircles
  id="circles"
  height={6}
  width={6}
  stroke={'black'}
  strokeWidth={1}
/>
```

### `PatternsHexagons`

![hexagon example](http://i.imgur.com/3EL1Lza.png)

``` js
<PatternHexagons
  id="hexagons"
  height={3}
  size={8}
  stroke={'red'}
  strokeWidth={1}
/>
```

### `PatternsLines`

![lines example](http://i.imgur.com/E3cTmLZ.png)

``` js
<PatternLines
  id="lines"
  height={5}
  width={5}
  stroke={'black'}
  strokeWidth={1}
  orientation={['diagonal']}
/>
```

### `PatternsWaves`

![waves example](http://i.imgur.com/4fdwbhv.png)

``` js
<PatternWaves
  id="waves"
  height={4}
  width={4}
  stroke={'blue'}
  strokeWidth={1}
/>
```

## Source For Components

+ [`<PatternCircles />`](https://github.com/hshoff/vx/blob/master/packages/vx-pattern/src/patterns/Circles.js)
+ [`<PatternHexagons />`](https://github.com/hshoff/vx/blob/master/packages/vx-pattern/src/patterns/Hexagons.js)
+ [`<PatternLines />`](https://github.com/hshoff/vx/blob/master/packages/vx-pattern/src/patterns/Lines.js)
+ [`<PatternPath />`](https://github.com/hshoff/vx/blob/master/packages/vx-pattern/src/patterns/Path.js)
+ [`<PatternPattern />`](https://github.com/hshoff/vx/blob/master/packages/vx-pattern/src/patterns/Pattern.js)
+ [`<PatternPath />`](https://github.com/hshoff/vx/blob/master/packages/vx-pattern/src/patterns/Waves.js)
