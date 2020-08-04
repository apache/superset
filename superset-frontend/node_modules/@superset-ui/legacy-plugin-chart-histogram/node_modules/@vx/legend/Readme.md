# @vx/legend

<a title="@vx/legend npm downloads" href="https://www.npmjs.com/package/@vx/legend">
  <img src="https://img.shields.io/npm/dm/@vx/legend.svg?style=flat-square" />
</a>

Legends associate shapes and colors to data, and are associated with scales.

## Example

```js
import { LegendThreshold } from '@vx/legend';
import { scaleThreshold } from '@vx/scale';

const threshold = scaleThreshold({
  domain: [0.02, 0.04, 0.06, 0.08, 0.1],
  range: ['#f2f0f7', '#dadaeb', '#bcbddc', '#9e9ac8', '#756bb1', '#54278f'],
});

function MyChart() {
  return (
    <div>
      <svg>{/** chart stuff */}</svg>
      <LegendThreshold
        scale={threshold}
        direction="column-reverse"
        itemDirection="row-reverse"
        labelMargin="0 20px 0 0"
        shapeMargin="1px 0 0"
      />
    </div>
  );
}
```

## Installation

```
npm install --save @vx/legend
```
