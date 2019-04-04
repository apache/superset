# @data-ui/histogram

A React + d3 library for creating histograms. Vertical or horizontal, raw data or binned data, numeric or categorical bins, counts or densities, cumulative or not.

`npm install --save @data-ui/histogram`

<a title="package version" href="https://img.shields.io/npm/v/@data-ui/histogram.svg?style=flat-square">
  <img src="https://img.shields.io/npm/v/@data-ui/histogram.svg?style=flat-square" />
</a>
<p align="center">
  <img width="600px" src="https://user-images.githubusercontent.com/4496521/28901809-a03e88a6-77af-11e7-9882-468d362289bd.gif" />
</p>

Demo it live at <a href="https://williaster.github.io/data-ui" target="_blank">williaster.github.io/data-ui</a>.

## Example usage
Similar to the `@data-ui/xy-chart` package, this `@data-ui/histogram` package exports a parent `<Histogram />` container component that renders an svg and coordinates scales across its children. You can pass the parent container optionally-animated `<BarSeries />` and/or `<DensitySeries />` as well as `<XAxis />` and `<YAxis />`.

```javascript
import { Histogram, DensitySeries, BarSeries, withParentSize, XAxis, YAxis } from '@data-ui/histogram';

const ResponsiveHistogram = withParentSize(({ parentWidth, parentHeight, ...rest}) => (
  <Histogram
    width={parentWidth}
    height={parentHeight}
    {...rest}
  />
);

const rawData = Array(100).fill().map(Math.random);

...
  render () {
    return (
      <ResponsiveHistogram
        ariaLabel="My histogram of ..."
        orientation="vertical"
        cumulative={false}
        normalized={true}
        binCount={25}
        valueAccessor={datum => datum}
        binType="numeric"
        renderTooltip={({ event, datum, data, color }) => (
          <div>
            <strong style={{ color }}>{datum.bin0} to {datum.bin1}</strong>
            <div><strong>count </strong>{datum.count}</div>
            <div><strong>cumulative </strong>{datum.cumulative}</div>
            <div><strong>density </strong>{datum.density}</div>
          </div>
        )}
      >
        <BarSeries
          animated
          rawData={rawData /* or binnedData={...} */}
        />
        <XAxis />
        <YAxis />
      </ResponsiveHistogram>
    );
  }
```

Demo with the <a href="https://williaster.github.io/data-ui" target="_blank">Histogram playground</a>.

## Components

Check out the example source code and PropTable tabs in the Storybook <a href="https://williaster.github.io/data-ui" target="_blank">williaster.github.io/data-ui</a>.

### `<Histogram />`

Name | Type | Default | Description
------------ | ------------- | ------- | ----
ariaLabel | PropTypes.string.isRequired | - | Accessibility label
binValues | PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.number, PropTypes.string])) | null | Bin thresholds, overrides binCount
binCount | PropTypes.number | 10 | an approximate number of bins to use (if data is not already binned)
binType | PropTypes.oneOf(['numeric', 'categorical']) | 'numeric' | Specify whether to bins are categorical or numeric
children | PropTypes.node.isRequired | - | Child Series, Axis, or other
cumulative | PropTypes.bool | false | whether to show a cumulative histogram
height | PropTypes.number.isRequired | - | height of the visualization
horizontal | PropTypes.bool | false | whether the histograms is oriented vertically or horizontally
limits | PropTypes.array | null | values outside the limits are ignored
margin | PropTypes.shape({ top: PropTypes.number, right: PropTypes.number, bottom: PropTypes.number, left: PropTypes.number }) | { top: 32, right: 32, bottom: 64, left: 64 } | chart margin, leave room for axes and labels!
normalized | PropTypes.bool | false | whether the value axis is normalized as fraction of total
theme | PropTypes.object | {} | chart theme object, see theme below.
width | PropTypes.number.isRequired | - | width of the svg
valueAccessor | PropTypes.func | d => d | for raw data, how to access the bin value

### `<*Series />`
`<BarSeries />` and `<DensitySeries />` components accept _either_ `rawData` or `binnnedData`. Raw data can be in any format as long as the value of each datum can be accessed with the Histogram `valueAccessor` function. Binned data should have the following shapes:

```javascript
export const numericBinnedDatumShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  bin0: PropTypes.number.isRequired,
  bin1: PropTypes.number.isRequired,
  count: PropTypes.number.isRequired,
});

export const categoricalBinnedDatumShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  bin: PropTypes.string.isRequired,
  count: PropTypes.number.isRequired,
});
```

If both `rawData` and `binnnedData` are provided, `rawData` is ignored.

### `<BarSeries />`

Name | Type | Default | Description
------------ | ------------- | ------- | ----
animated | PropTypes.bool | true | whether to animate updates to the data in the series
rawData | PropTypes.array | [] | raw datum
binnedData | binnedDataShape | [] | binned data
fill | PropTypes.oneOfType([PropTypes.func, PropTypes.string]) | @data-ui/theme.color.default | determines bar fill color
fillOpacity | PropTypes.oneOfType([PropTypes.func, PropTypes.number]) | 0.7 | opacity of bar fill
stroke | PropTypes.oneOfType([PropTypes.func, PropTypes.string]) | 'white' | determines bar stroke color
strokeWidth | PropTypes.oneOfType([PropTypes.func, PropTypes.number]) | 1 | determines width of bar outline
onClick | PropTypes.func | -- | Called on bar click with a signature of `({ event, data, datum, color, index })`


### `<DensitySeries />`

For _raw data_ that is _numeric_, the `<DensitySeries />` plots an estimates of the probability density function, i.e., a kernel density estimate. If pre-aggregated and/or categorical data is passed to the Series, it plots an Area graph of values based on the data counts.

Name | Type | Default | Description
------------ | ------------- | ------- | ----
animated | PropTypes.bool | true | whether to animate updates to the data in the series
rawData | PropTypes.array | [] | raw datum
binnedData | binnedDataShape | [] | binned data
fill | PropTypes.oneOfType([PropTypes.func, PropTypes.string]) | @data-ui/theme.color.default | determines bar fill color
kernel | PropTypes.oneOf(['gaussian', 'parabolic']) | 'gaussian' | kernel function type, parabolic = epanechnikov kernel
showArea | PropTypes.bool | true | whether to show density area fill
showLine | PropTypes.bool | true | whether to show density line path
smoothing | PropTypes.number | 1 | smoothing constant for parabolic / epanechinikov kernel function
fillOpacity | PropTypes.oneOfType([PropTypes.func, PropTypes.number]) | 0.7 | opacity of area fill if shown
stroke | PropTypes.oneOfType([PropTypes.func, PropTypes.string]) | 'white' | determines line color if shown
strokeWidth | PropTypes.oneOfType([PropTypes.func, PropTypes.number]) | 2 | determines width of line path if shown
strokeDasharray | PropTypes.oneOfType([PropTypes.func, PropTypes.string]) | '' | determines dash pattern of line if shown
strokeLinecap | PropTypes.oneOf(['butt', 'square', 'round', 'inherit']) | 'round' | style of line path stroke
useEntireScale | PropTypes.bool | false | if true, density plots will scale to fill the entire y-range of the plot. if false, the maximum value is scaled to the count of the series


### `<XAxis />` and `<YAxis />`

Name | Type | Default | Description
------------ | ------------- | ------- | ----
axisStyles | axisStylesShape | {} | config object for axis and axis label styles, see theme below
label | PropTypes.oneOfType([PropTypes.string, PropTypes.element]) | <text {...axisStyles.label[orientation]} /> | string or component for axis labels
numTicks | PropTypes.number | null | approximate number of ticks
orientation | XAxis PropTypes.oneOf(['bottom', 'top']) or YAxis PropTypes.oneOf(['left', 'right']) | bottom, left | orientation of axis
tickStyles | tickStylesShape | {} | config object for styling ticks and tick labels, see theme below
tickLabelComponent | PropTypes.element | <text {...tickStyles.label[orientation]} /> | component to use for tick labels
tickFormat | PropTypes.func | null | (tick, tickIndex) => formatted tick
tickValues | PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.number, PropTypes.string])) | null | custom tick values


### Tooltips
Tooltips are supported for histogram `BarSeries`. The _easiest_ way to use tooltips out of the box is by passing a `renderTooltip` function to `<Histogram />` as shown in the above example. This function takes an object with the shape `{ event, datum, data, color }` as input and should return the inner contents of the tooltip (not the tooltip container!) as shown above.  `datum` corresponds to the _binned_ data point, see the above-specified shapes which depend on whether your bins are categorical or numeric. `color` represents the bar fill. If this function returns a `falsy` value, a tooltip will not be rendered.

Under the covers this will wrap the `<Histogram />` component in the exported `<WithTooltip />` HOC, which wraps the `svg` in a `<div />` and handles the positioning and rendering of an HTML-based tooltip with the contents returned by `renderTooltip()`. This tooltip is aware of the bounds of its container and should position itself "smartly".

If you'd like more customizability over tooltip rendering you can do either of the following:

1) Roll your own tooltip positioning logic and pass `onMouseMove` and `onMouseLeave` functions to `Histogram`. These functions are passed to the `<BarSeries />` children and are called with the signature `onMouseMove({ data, datum, event, color })` and `onMouseLeave()` upon appropriate trigger.

2) Wrap `<Histogram />` in `<WithTooltip />` yourself, which accepts props for additional customization:

Name | Type | Default | Description
------------ | ------------- | ------- | ----
children | PropTypes.func or PropTypes.object | - | Child function (to call) or element (to clone) with onMouseMove, onMouseLeave, and tooltipData props/keys
className | PropTypes.string | - | Class name to add to the `<div>` container wrapper
renderTooltip | PropTypes.func.isRequired | - | Renders the _contents_ of the tooltip, signature of `({ event, data, datum, color, index }) => node`. If this function returns a `falsy` value, a tooltip will not be rendered.
styles | PropTypes.object | {} | Styles to add to the `<div>` container wrapper
TooltipComponent | PropTypes.func or PropTypes.object | `@vx`'s `TooltipWithBounds` | Component (not instance) to use as the tooltip container component. It is passed `top` and `left` numbers for positioning
tooltipProps | PropTypes.object | - | Props that are passed to `TooltipComponent`
tooltipTimeout | PropTypes.number | 200 | Timeout in ms for the tooltip to hide upon calling `onMouseLeave`

### Theme
A theme object with the following shape can be passed to `<Histogram />` to style the chart, axes, and series. Alternatively, keys (eg `xAxisStyles`) can be passed directly to the axes components.

See <a href="https://github.com/williaster/data-ui/blob/master/packages/data-ui-theme/src/chartTheme.js" target="_blank">`@data-ui/theme`</a> for an example.

```
export const themeShape = PropTypes.shape({
  gridStyles: PropTypes.shape({
    stroke: PropTypes.string,
    strokeWidth: PropTypes.number,
  }),
  xAxisStyles: PropTypes.shape({
    stroke: PropTypes.string,
    strokeWidth: PropTypes.number,
    label: PropTypes.shape({
      bottom: PropTypes.object,
      top: PropTypes.object,
    }),
  }),
  yAxisStyles: PropTypes.shape({
    stroke: PropTypes.string,
    strokeWidth: PropTypes.number,
    label: PropTypes.shape({
      left: PropTypes.object,
      right: PropTypes.object,
    }),
  })
  xTickStyles: PropTypes.shape({
    stroke: PropTypes.string,
    tickLength: PropTypes.number,
    label: PropTypes.shape({
      bottom: PropTypes.object,
      top: PropTypes.object,
    }),
  }),
  yTickStyles: PropTypes.shape({
    stroke: PropTypes.string,
    tickLength: PropTypes.number,
    label: PropTypes.shape({
      left: PropTypes.object,
      right: PropTypes.object,
    }),
  }),
});
```

## Development
```
npm install
yarn run dev # or 'build'
```
