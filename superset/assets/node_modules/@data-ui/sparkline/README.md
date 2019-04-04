# @data-ui/sparkline

A React + d3 library for creating sparklines 📈 implemented with <a href="vx-demo.now.sh" target="_blank">vx</a>.

`npm install --save @data-ui/sparkline`

<a title="package version" href="https://img.shields.io/npm/v/@data-ui/sparkline.svg?style=flat-square">
  <img src="https://img.shields.io/npm/v/@data-ui/sparkline.svg?style=flat-square" />
</a>
<p align="center">
  <img width="400px" src="https://user-images.githubusercontent.com/4496521/29400148-001a942c-82e1-11e7-85e5-a77b0db97b79.png" />
</p>

Demo it live at <a href="https://williaster.github.io/data-ui" target="_blank">williaster.github.io/data-ui</a>.

## Example usage
Sparklines are composable using the container `<Sparkline />` component and different types of children including one or more `<*Series />` components and reference lines or bands. Additionally, you can customize aesthetics using the exported `<PatternLines />` and `<LinearGradient/>` components.

Note that the order of children passed to `<Sparkline />` determines their rendering order, for example a `<HorizontalReferenceLine />` passed after a `<BarSeries />` will overlay the line on the bars.

```javascript
import {
  Sparkline,
  LineSeries,
  HorizontalReferenceLine,
  BandLine,
  PatternLines,
  PointSeries } from '@data-ui/sparkline';
import { allColors } from '@data-ui/theme'; // open-color colors

const data = Array(25).fill().map(Math.random);

<Sparkline
      ariaLabel="A line graph of randomly-generated data"
      margin={{ top: 24, right: 64, bottom: 24, left: 64,}}
      width={500}
      height={100}
      data={data}
      valueAccessor={datum => datum}
    >
      {/* this creates a <defs> referenced for fill */}
      <PatternLines
        id="unique_pattern_id"
        height={6}
        width={6}
        stroke={allColors.grape[6]}
        strokeWidth={1}
        orientation={['diagonal']}
      />
      {/* display innerquartiles of the data */}
      <BandLine
        band="innerquartiles"
        fill="url(#unique_pattern_id)"
      />
      {/* display the median */}
      <HorizontalReferenceLine
        stroke={allColors.grape[8]}
        strokeWidth={1}
        strokeDasharray="4 4"
        reference="median"
      />
      {/* Series children are passed the data from the parent Sparkline */}
      <LineSeries
        showArea={false}
        stroke={allColors.grape[7]}
      />
      <PointSeries
        points={['min', 'max']}
        fill={allColors.grape[3]}
        size={5}
        stroke="#fff"
        renderLabel={val => val.toFixed(2)}
      />
    </Sparkline>
```

## Components

Check out the example source code and PropTable tabs in the Storybook <a href="https://williaster.github.io/data-ui" target="_blank">williaster.github.io/data-ui</a> for more!

#### `<Sparkline />`
The `Sparkline` component renders an `<svg />` and coordinates scales across all of it's child series and reference lines. It takes the following props:

Name | Type | Default | Description
------------ | ------------- | ------- | ----
ariaLabel | PropTypes.string.isRequired | - | Accessibility label for the svg
children | PropTypes.node.isRequired | - | Child series, reference lines, defs, or other valid svg children
className | PropTypes.string | - | Optional className to add to the svg
data | PropTypes.array | [] | an array of data that is shared across, items can be any shape or number
height | PropTypes.number.isRequired | - | Height of the svg including top/bottom margin
margin | PropTypes.shape({ top: PropTypes.number, right: PropTypes.number, bottom: PropTypes.number, left: PropTypes.number }) | { top: 16, right: 16, bottom: 16, left: 16 } | chart margin, leave room for labels! note 0 may clip LineSeries and PointSeries. a partial { top/right/bottom/ left } object is filled with the other default values
max | PropTypes.number | - | Optionally set the maximum y-value of the chart (e.g., to coordinate axes across multiple Sparklines)
min | PropTypes.number | - | Optionally set the minimum y-value of the chart (e.g., to coordinate axes across multiple Sparklines)
onMouseMove | PropTypes.func | - | `func({ data, datum, event, index, color })`, passed to an invisible `BarSeries` that intercepts all mouse events (can pass to individual series for more control)
onMouseLeave | PropTypes.func | - | `func()`, passed to an invisible `BarSeries` that intercepts all mouse events
styles | PropTypes.object | - | Optional styles to apply to the svg
width | PropTypes.number.isRequired | - | Width of the svg including left/right margin
valueAccessor | PropTypes.func | d => d | Optional accessor function that takes an item from the data array as input and returns the y value of the datum. This value is passed back in e.g., `renderLabel` functions.


### Series
The following series components are available, they are passed the data and scales from the parent `Sparkline` component, and you may compose multiple to create the sparkline you want 😍:
* `<LineSeries />`
* `<PointSeries />`
* `<BarSeries />`

`<PointSeries />` and `<BarSeries />` support labeling of specific data points.

#### `<LineSeries />`
This component can be used to create lines and or area sparklines with various `curve` types, and takes the following props:

Name | Type | Default | Description
------------ | ------------- | ------- | ----
fill | PropTypes.string | `@data-ui/theme`s color.default | If `showArea=true`, this sets the `fill` of the area path.
fillOpacity | PropTypes.number | 0.3 | If `showArea=true`, this sets the `fillOpacity` of the `area` shape.
curve | PropTypes.oneOf(['linear', 'cardinal', 'basis', 'monotoneX']) | 'cardinal' | The type of curve interpolator to use.
onMouseMove | PropTypes.func | - | `func({ data, datum, event, index, color })` called on line mouse move for the closest datum
onMouseLeave | PropTypes.func | - | `func()` called on line mouse leave
showArea | PropTypes.bool | false | Boolean indicating whether to render an Area path.
showLine | PropTypes.bool | true | Boolean indicating whether to render a Line path.
stroke | PropTypes.string | `@data-ui/theme`s color.default | If `showLine=true`, this sets the `stroke` of the line path.
strokeDasharray | PropTypes.string | - | If `showLine=true`, this sets the `strokeDasharray` attribute of the line path.
strokeLinecap | PropTypes.oneOf(['butt', 'square', 'round', 'inherit']) | 'round' | If `showLine=true`, this sets the `strokeLinecap` attribute of the line path.
strokeWidth | PropTypes.number | 2 | If `showLine=true`, this sets the `strokeWidth` attribute of the line path.

#### `<BarSeries />`
This component can be used to bar-graph sparklines and takes the following props:

Name | Type | Default | Description
------------ | ------------- | ------- | ----
fill | PropTypes.oneOfType([PropTypes.func, PropTypes.string]) | `@data-ui/theme`s color.default | A single `fill` to use for all `Bar`s or a function with the following signature `(yVal, i) => fill` called for each data point. If data objects have a `fill` property, it overrides this value.
fillOpacity | PropTypes.oneOfType([PropTypes.func, PropTypes.number]) | `0.7` | A single `fillOpacity` value (0 - 1) to use for all `Bar`s or a function with the following signature `(yVal, i) => opacity` called for each data point. If data objects have a `fillOpacity` property, it overrides this value.
LabelComponent | PropTypes.element | `@data-ui/sparkline`'s `<Label />` component | Component to use for labels, if relevant. This component is cloned with appropriate x, y, dx, and dy values for positioning.
labelOffset | PropTypes.number | `8` | (Absolute) pixel offset to use for positioning a label relative to a `Bar`. `labelPosition` is used to determine direction.
labelPosition | PropTypes.oneOfType([PropTypes.func, PropTypes.oneOf(['top', 'right', 'bottom', 'left']), ]) | 'top' | A single string indicating how to position a label relative to the top point of a bar, or a function with the following signature `(yVal, i) => position` called for each data point. If the return value is not one of top, right, bottom, left, it is spread on the `LabelComponent` directly (e.g., `{ dx: -100, dy: 100 }`)
onMouseMove | PropTypes.func | - | `func({ data, datum, event, index, color })` called on bar mouse move
onMouseLeave | PropTypes.func | - | `func()` called on bar mouse leave
renderLabel | PropTypes.func | - | Optional function called for each datum, with the following signature `(yVal, i) => node`. If this is passed to the Series and returns a value, a label will be rendered for the passed point. This is used as the child of `LabelComponent` so any valid child of svg `<text>` elements can be returned.
stroke | PropTypes.oneOfType([PropTypes.func, PropTypes.string]) | `white` | A single `stroke` to use for all `Bar`s or a function with the following signature `(yVal, i) => stroke`. If data objects have a `stroke` property, it overrides this value.
strokeWidth | PropTypes.oneOfType([PropTypes.func, PropTypes.number]) | `1` | A single `strokeWidth` to use for all `Bar`s or a function with the following signature `(yVal, i) => stroke`. If data objects have a `strokeWidth` property, it overrides this value.


#### `<PointSeries />`
This component can be used to render all or a subset of points for a sparkline and takes the following props:

Name | Type | Default | Description
------------ | ------------- | ------- | ----
fill | PropTypes.oneOfType([PropTypes.func, PropTypes.string]) | `@data-ui/theme`s color.default | A single `fill` to use for all `Point`s or a function with the following signature `(yVal, i) => fill` called for each data point. If data objects have a `fill` property, it overrides this value.
fillOpacity | PropTypes.oneOfType([PropTypes.func, PropTypes.number]) | `1` | A single `fillOpacity` value (0 - 1) to use for all `Point`s or a function with the following signature `(yVal, i) => opacity` called for each data point. If data objects have a `fillOpacity` property, it overrides this value.
LabelComponent | PropTypes.element | `@data-ui/sparkline`'s `<Label />` component | Component to use for labels, if relevant. This component is cloned with appropriate x, y, dx, and dy values for positioning.
labelOffset | PropTypes.number | `12` | (Absolute) pixel offset to use for positioning a label relative to a `Point`. `labelPosition` is used to determine direction.
labelPosition | PropTypes.oneOfType([PropTypes.func, PropTypes.oneOf(['auto', 'top', 'right', 'bottom', 'left']), ]) | 'auto' | A single string indicating how to position a label relative to the center of a point, or a function with the following signature `(yVal, i) => position` called for each data point. 'auto' attempts to position the label on top or bottom of a point depending on the surrounding data points. If the return value is not one of auto, top, right, bottom, left, it is spread on the `LabelComponent` directly (e.g., `{ dx: -100, dy: 100 }`)
onMouseMove | PropTypes.func | - | `func({ data, datum, event, index, color })` called on point mouse move
onMouseLeave | PropTypes.func | - | `func()` called on point mouse leave
points | PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf(['all', 'min', 'max', 'first', 'last']), ])) | `['min', 'max']` | String(s) or index(s) indicating which point(s) to render. e.g., If `all`, all points are rendered, if `['min', 'max']`, only the minimum and maximum points are rendered.
size | PropTypes.oneOfType([PropTypes.func, PropTypes.number]) | `3` | A single `size` to use as the radius of all `Points`s or a function with the following signature `(yVal, i) => size` called for each data point. If data objects have a `size` property, it overrides this value.
renderLabel | PropTypes.func | - | Optional function called for each datum, with the following signature `(yVal, i) => node`. If this is passed to the Series and returns a value, a label will be rendered for the passed point. This is used as the child of `LabelComponent` so any valid child of svg `<text>` elements can be returned.
stroke | PropTypes.oneOfType([PropTypes.func, PropTypes.string]) | `white` | A single `stroke` to use for all `Point`s or a function with the following signature `(yVal, i) => stroke`. If data objects have a `stroke` property, it overrides this value.
strokeWidth | PropTypes.oneOfType([PropTypes.func, PropTypes.number]) | `1` | A single `strokeWidth` to use for all `Point`s or a function with the following signature `(yVal, i) => stroke`. If data objects have a `strokeWidth` property, it overrides this value.

### Tooltips
You can add tooltips to `<Sparkline />` components by wrapping them with the higher-order `<WithTooltip />` component. This component accepts a `renderTooltip` function whose output is rendered into a boundary-aware (html-based) tooltip. `<WithTooltip />` handles tooltip visibility state and passes `onMouseMove` `onMouseLeave` and `tooltipData` props to its child. If these are passed to `<Sparkline />`, it will render a series of invisible `Bar`s to intercept mouse events. If they are passed to individual series, mouse events will be handled on the series level.

See the <a href="https://williaster.github.io/data-ui" target="_blank">storybook</a> for example usage!

Name | Type | Default | Description
------------ | ------------- | ------- | ----
children | PropTypes.func or PropTypes.object | - | Child function (to call) or element (to clone) with onMouseMove, onMouseLeave, and tooltipData props/keys
className | PropTypes.string | - | Class name to add to the `<div>` container wrapper
renderTooltip | PropTypes.func.isRequired | - | Renders the _contents_ of the tooltip, signature of `({ event, data, datum, color }) => node`. If this function returns a `falsy` value, a tooltip will not be rendered.
styles | PropTypes.object | {} | Styles to add to the `<div>` container wrapper
TooltipComponent | PropTypes.func or PropTypes.object | `@vx`'s `TooltipWithBounds` | Component (not instance) to use as the tooltip container component. It is passed `top` and `left` numbers for positioning
tooltipProps | PropTypes.object | - | Props that are passed to `TooltipComponent`
tooltipTimeout | PropTypes.number | 200 | Timeout in ms for the tooltip to hide upon calling `onMouseLeave`


### Reference lines and bands
The following reference line components are exported to support different types of annotations you may want:
* `<HorizontalReferenceLine />`
* `<VerticalReferenceLine />`
* `<BandLine />`.

#### `<HorizontalReferenceLine />`
This component can be used to render a single horizontal reference line to call out a point of interest. It takes the following props:

Name | Type | Default | Description
------------ | ------------- | ------- | ----
reference | PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf(['mean', 'median', 'min', 'max'] ])) | `mean` | What reference to create a line for. This may be a raw number to call out, or one of `'mean', 'median', 'min', 'max'` which will compute the relevant y value.
LabelComponent | PropTypes.element | `@data-ui/sparkline`'s `<Label />` component | Component to use for labels, if relevant. This component is cloned with appropriate x, y, dx, and dy values for positioning.
labelOffset | PropTypes.number | `8` | (Absolute) pixel offset to use for positioning a label relative to a `Point`. `labelPosition` is used to determine direction.
labelPosition | PropTypes.oneOf(['top', 'right', 'bottom', 'left']) | 'right' | A single string indicating how to position a label relative to the end of a reference line
renderLabel | PropTypes.func | - | Optional function called for each datum, with the following signature `(yVal) => node`. If this is passed and returns a value, a label will be rendered. This is used as the child of `LabelComponent` so any valid child of svg `<text>` elements can be returned.
stroke | PropTypes.string | `@data-ui/theme`s color.default | Sets the `stroke` of the line path.
strokeDasharray | PropTypes.string | - | Sets the `strokeDasharray` attribute of the line path.
strokeLinecap | PropTypes.oneOf(['butt', 'square', 'round', 'inherit']) | 'round' | Sets the `strokeLinecap` attribute of the line path.
strokeWidth | PropTypes.number | 2 | Sets the `strokeWidth` attribute of the line path.

#### `<VerticalReferenceLine />`
@TODO picture

This component can be used to render a single vertical reference line to call out a point of interest. It takes the following props:

Name | Type | Default | Description
------------ | ------------- | ------- | ----
reference | PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf(['first', 'last', 'min', 'max'] ])) | `last` | What reference to create a line for. This may be a raw number (x index) to call out, or one of `'first', 'last', 'min', 'max'` which will compute the relevant x index value.
LabelComponent | PropTypes.element | `@data-ui/sparkline`'s `<Label />` component | Component to use for labels, if relevant. This component is cloned with appropriate x, y, dx, and dy values for positioning.
labelOffset | PropTypes.number | `10` | (Absolute) pixel offset to use for positioning a label relative to a `Point`. `labelPosition` is used to determine direction.
labelPosition | PropTypes.oneOf(['top', 'right', 'bottom', 'left']) | 'top' | A single string indicating how to position a label relative to the top of a reference line
renderLabel | PropTypes.func | - | Optional function called for each datum, with the following signature `(xVal) => node`. If this is passed and returns a value, a label will be rendered. This is used as the child of `LabelComponent` so any valid child of svg `<text>` elements can be returned.
stroke | PropTypes.string | `@data-ui/theme`s color.default | Sets the `stroke` of the line path.
strokeDasharray | PropTypes.string | - | Sets the `strokeDasharray` attribute of the line path.
strokeLinecap | PropTypes.oneOf(['butt', 'square', 'round', 'inherit']) | 'round' | Sets the `strokeLinecap` attribute of the line path.
strokeWidth | PropTypes.number | 2 | Sets the `strokeWidth` attribute of the line path.

#### `<BandLine />`
This component can be used to render _ranges_ of interest as opposed to single values. It may be used to create vertical or horizontal bands and takes the following props:

Name | Type | Default | Description
------------ | ------------- | ------- | ----
band | PropTypes.oneOfType([PropTypes.oneOf([ 'innerQuartiles' ]), PropTypes.shape({ from: PropTypes.shape({ x: PropTypes.number, y: PropTypes.number }).isRequired, to: PropTypes.shape({ x: PropTypes.number, y: PropTypes.number }) ]).isRequired }) | 'innerQuartiles' | Specifies the band to render. May be `innerQuartiles` which computes the midspread of the data values, or an object with the keys `{ from: coords, to: coords }` specifying a custom band. If an `x` or `y` value is missing in either the `from` or `to` key, the bounds (min, max) of the chart are used.
fill | PropTypes.string | `@data-ui/theme`s color.lightGray | Sets the `fill` of the bar shape.
fillOpacity | PropTypes.number | `0.5` | Sets the `fillOpacity` of the bar shape.
stroke | PropTypes.string | `transparent` | Sets the `stroke` of the bar shape.
strokeWidth | PropTypes.number | `0` | Sets the `strokeWidth` of the bar shape.


#### `<PatternLines />` and `<LinearGradient/>`s
These components are exported for convenience from `@vx` to support customization of the aesthetics of your sparklines. They create `<defs/>` elements with the specified `id`, which are then referenced for fills or strokes in other components via `url(#my_id)`. See example usage above and the <a href="https://williaster.github.io/data-ui" target="_blank">Storybook</a> for examples!

They take the following props:

#### `<PatternLines />`
Name | Type | Default | Description
------------ | ------------- | ------- | ----
id | PropTypes.string.isRequired | - | `id` for the `<defs>` that is created. When used as a fill in another component it can be referenced via `url(#my_id)`.
width | PropTypes.number.isRequired | - | Width of the pattern (which is then repeated).
height | PropTypes.number.isRequired | - | Height of the pattern (which is then repeated).
stroke | PropTypes.string | - | Sets the `stroke` attribute of the pattern line.
strokeWidth | PropTypes.number | - | Sets the `strokeWidth` attribute of the pattern line.
strokeDasharray | PropTypes.string | - | Sets the `strokeDasharray` attribute of the pattern line.
strokeLinecap | PropTypes.string | 'square' | Sets the `strokeLinecap` attribute of the pattern line.
shapeRendering | PropTypes.string | 'auto' | Sets the `shapeRendering` attribute of the pattern line.
orientation | PropTypes.arrayOf(PropTypes.oneOf(['vertical', 'horizontal', 'diagonal'])) | ['vertical'] | Array of orientations for lines. If multiple are passed, one path is rendered for each.
background | PropTypes.string | - | Optional background fill for the pattern.
className | PropTypes.string | - | Optional className added to the pattern `path`'s.

#### `<LinearGradient />`
Name | Type | Default | Description
------------ | ------------- | ------- | ----
id | PropTypes.string.isRequired | - | `id` for the `<defs>` that is created. When used as a fill in another component it can be referenced via `url(#my_id)`.
from | PropTypes.string | - | String used for the start color in the gradient.
to | PropTypes.string | - | String used for the end color in the gradient.
fromOffset | PropTypes.string | `0%` | Sets the offset (as a %) of the `from` color.
fromOpacity | PropTypes.number | 1 | Sets the opacity of the `from` color.
toOffset | PropTypes.string | `100%` | Sets the offset (as a %) of the `to` color
toOpacity | PropTypes.number | 1 | Sets the opacity of the `to` color.
rotate | PropTypes.oneOfType([PropTypes.string, PropTypes.number]) | - | Sets the `transform` attribute of the gradient to `rotate(<rotate>)`  
transform | PropTypes.string | - | Sets the `gradientTransform` of the `linearGradient` element, overridden by `rotate`
