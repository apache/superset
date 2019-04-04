# @vx/legend

```
npm install --save @vx/legend
```

Legends associate shapes and colors to data.

```js
// legends for linear scales
import { LegendLinear } from '@vx/legend';

// legends for quantile scales
import { LegendQuantile } from '@vx/legend';

// legends for ordinal scales
import { LegendOrdinal } from '@vx/legend';

// legends for size scales
import { LegendSize } from '@vx/legend';

// legends for threshold scales
import { LegendThreshold } from '@vx/legend';

// custom legends
import { Legend } from '@vx/legend';
```

## API

#### LegendLinear
#### LegendQuantile
#### LegendOrdinal
#### LegendThreshold
#### LegendSize
#### Legend


## Example

```js
import { LegendThreshold } from '@vx/legend';
import { scaleThreshold } from '@vx/scale';

const threshold = scaleThreshold({
  domain: [0.02, 0.04, 0.06, 0.08, 0.1],
  range: [
    '#f2f0f7',
    '#dadaeb',
    '#bcbddc',
    '#9e9ac8',
    '#756bb1',
    '#54278f',
  ],
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