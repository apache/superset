# @data-ui/radial-chart

demo at
<a href="https://williaster.github.io/data-ui" target="_blank">williaster.github.io/data-ui</a>

## Overview

This package exports declarative react `<RadialChart />`s implemented with
<a href="vx-demo.now.sh" target="_blank">@vx</a> which can be used to render both donut and pie
charts depending on props. As demonstrated in the demo, in combination with
[@vx/legend](https://vx-demo.now.sh/legends) and
<a href="https://github.com/hshoff/vx/tree/master/packages/vx-scale" target="_blank">@vx/scale</a>
these can be used to create re-usable radial charts.

### Usage

See the demo at
<a href="https://williaster.github.io/data-ui" target="_blank">williaster.github.io/data-ui</a> for
more example outputs.

<img width="500" alt="Donut chart" src="https://user-images.githubusercontent.com/4496521/29235607-03a68b30-7eb5-11e7-8ccf-dec925ba2d28.gif">

```js
import { scaleOrdinal } from '@vx/scale';
import { LegendOrdinal } from '@vx/legend';

import { color as colors } from '@data-ui/theme';
import { RadialChart, ArcSeries, ArcLabel } from '@data-ui/radial-chart';

const colorScale = scaleOrdinal({ range: colors.categories });
const data = [{ label: 'a', value: 200 }, { label: 'c', value: 150 }, { label: 'c', value: 21 }];

export default () => (
  <div style={{ display: 'flex', alignItems: 'center' }}>
    <RadialChart
      ariaLabel="This is a radial-chart chart of..."
      width={width}
      height={height}
      margin={{ top, right, bottom, left }}
      renderTooltip={({ event, datum, data, fraction }) => (
        <div>
          <strong>{datum.label}</strong>
          {datum.value} ({(fraction * 100).toFixed(2)}%)
        </div>
      )}
    >
      <ArcSeries
        data={data}
        pieValue={d => d.value}
        fill={arc => colorScale(arc.data.label)}
        stroke="#fff"
        strokeWidth={1}
        label{arc => `${(arc.data.value).toFixed(1)}%`}
        labelComponent={<ArcLabel />}
        innerRadius={radius => 0.35 * radius}
        outerRadius={radius => 0.6 * radius}
        labelRadius={radius => 0.75 * radius}
      />
    </RadialChart>
    <LegendOrdinal
      direction="column"
      scale={colorScale}
      shape="rect"
      fill={({ datum }) => colorScale(datum)}
      labelFormat={label => label}
    />
  </div>
);
```

### Tooltips

The _easiest_ way to use tooltips out of the box is by passing a `renderTooltip` function to
`<RadialChart />`. This function takes an object with the shape `{ event, datum, data, fraction }`
as input and should return the inner contents of the tooltip (not the tooltip container!) as shown
above. If this function returns a `falsy` value, a tooltip will not be rendered.

Under the covers this will wrap the `<RadialChart />` component in the exported `<WithTooltip />`
HOC, which wraps the `svg` in a `<div />` and handles the positioning and rendering of an HTML-based
tooltip with the contents returned by `renderTooltip()`. This tooltip is aware of the bounds of its
container and should position itself "smartly".

If you'd like more customizability over tooltip rendering you can do either of the following:

1. Roll your own tooltip positioning logic and pass `onMouseMove` and `onMouseLeave` functions to
   `RadialChart`. These functions are passed to the `<ArcSeries />` children and are called with the
   signature `onMouseMove({ datum, event })` and `onMouseLeave()` upon appropriate trigger.

2. Wrap `<RadialChart />` in `<WithTooltip />` yourself, which accepts props for additional
   customization:

| Name             | Type                               | Default                     | Description                                                                                                                                                                 |
| ---------------- | ---------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| children         | PropTypes.func or PropTypes.object | -                           | Child function (to call) or element (to clone) with onMouseMove, onMouseLeave, and tooltipData props/keys                                                                   |
| className        | PropTypes.string                   | -                           | Class name to add to the `<div>` container wrapper                                                                                                                          |
| renderTooltip    | PropTypes.func.isRequired          | -                           | Renders the _contents_ of the tooltip, signature of `({ event, data, datum, fraction }) => node`. If this function returns a `falsy` value, a tooltip will not be rendered. |
| styles           | PropTypes.object                   | {}                          | Styles to add to the `<div>` container wrapper                                                                                                                              |
| TooltipComponent | PropTypes.func or PropTypes.object | `@vx`'s `TooltipWithBounds` | Component (not instance) to use as the tooltip container component. It is passed `top` and `left` numbers for positioning                                                   |
| tooltipProps     | PropTypes.object                   | -                           | Props that are passed to `TooltipComponent`                                                                                                                                 |
| tooltipTimeout   | PropTypes.number                   | 200                         | Timeout in ms for the tooltip to hide upon calling `onMouseLeave`                                                                                                           |

Note that currently this is implemented with `@vx/tooltips`'s `withTooltip` HOC, which adds an
_additional_ div wrapper.

### Roadmap

- more types of radial series
- animations / transitions

### NOTE ‼️

Although pie 🍰 and donut 🍩 charts are frequently encountered, they are not the most _effective_
visualization for conveying quantitative information. With that caveat, when used well they can
effectively give an overview of population makeup which is an entirely reasonable use of these
charts. We don't recommend using >7 slices for user readability.
