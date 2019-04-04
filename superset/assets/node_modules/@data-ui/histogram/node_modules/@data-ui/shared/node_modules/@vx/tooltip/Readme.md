# @vx/tooltip

```
npm install --save @vx/tooltip
```

The `@vx/tooltip` package provides utilities for making it easy to add `Tooltip`s to a visualization and includes higher-order component (HOC) enhancers and Tooltip components.

### Example:
``` js
import { withTooltip, TooltipWithBounds } from '@vx/tooltip';
import { localPoint } from '@vx/event';

class Chart extends React.Component {
  handleMouseOver = (event, datum) => {
    const coords = localPoint(event.target.ownerSVGElement, event);
    this.props.showTooltip({
      tooltipLeft: coords.x,
      tooltipTop: coords.y,
      tooltipData: datum
    });
  };

  render() {
    const {
      tooltipData,
      tooltipLeft,
      tooltipTop,
      tooltipOpen,
      hideTooltip
    } = this.props;

    return (
      // note React.Frament is only available in >= react@16.2
      <React.Fragment>
        <svg width={...} height={...}>
          // Chart here...
          <SomeChartElement onMouseOver={this.handleMouseOver} onMouseOut={hideTooltip} />
        </svg>

        {tooltipOpen && (
          <TooltipWithBounds
            // set this to random so it correctly updates with parent bounds
            key={Math.random()}
            top={tooltipTop}
            left={tooltipLeft}
          >
            Data value <strong>{tooltipData}</strong>
          </TooltipWithBounds>
        )}
      </React.Fragment>
    );
  }
}

const ChartWithTooltip = withTooltip(Chart);

render(<ChartWithTooltip />, document.getElementById("root"));
```

Example codesandbox [here](https://codesandbox.io/s/kw02m019mr).

### Enhancers
#### withTooltip(BaseComponent [, containerProps])
If you would like to add tooltip state logic to your component, you may wrap it in `withTooltip(BaseComponent [, containerProps])`.
The HOC will wrap your component in a `div` with `relative` positioning by default and handle state for tooltip positioning, visibility, and content by injecting the following props into your `BaseComponent`:


You may override the container by specifying `containerProps` as the second argument to `withTooltip`.

| Name | Type | Description |
|:---- |:---- |:----------- |
| showTooltip | func | Call this function with the signature `func({ tooltipData, tooltipLeft, tooltipTop })` to set the tooltip state to the specified values.
| hideTooltip | func | Call this function to close a tooltip, i.e., set the `showTooltip` state to `false`.
| tooltipOpen | bool | Whether the tooltip state is open or closed |
| tooltipLeft | number | The `tooltipLeft` position passed to the `showTooltip` func, intended to be used for tooltip positioning |
| tooltipTop | number | The `tooltipTop` position passed to the `showTooltip` func, intended to be used for tooltip positioning |
| tooltipData | any | The `tooltipData` value passed to the `showTooltip` func, intended to be used for any data that your tooltip might need to render |
| updateTooltip | func | Call this function with the signature `func({ tooltipOpen, tooltipLeft, tooltipTop, tooltipData })` to set the tooltip state to the specified values. |


### Components
#### <Tooltip />
This is a simple Tooltip container component meant to be used to actually render a Tooltip. It accepts the following props, and will spread any additional props on the tooltip container div (i.e., ...restProps):

| Name | Type | Default | Description |
|:---- |:---- |:------- |:----------- |
| left | number or string | -- | Sets style.left of the tooltip container
| top | number or string | -- | Sets style.top of the tooltip container
| className | string | -- | Adds a class (in addition to `vx-tooltip-portal`) to the tooltip container
| style | object | -- | Sets / overrides any styles on the tooltip container (including top and left)
| children | node | -- | Sets the children of the tooltip, i.e., the actual content


#### TooltipWithBounds
This tooltip component is exactly the same as `Tooltip` above, but it is aware of its boundaries meaning that it will flip left/right and bottom/top based on whether it would overflow its parent's boundaries. It accepts the following props, and will spread any additional props on the Tooltip component (i.e., ...restProps):

| Name | Type | Default | Description |
|:---- |:---- |:------- |:----------- |
| left | number | -- | The horizontal position of the cursor, tooltip will be place to the left or right of this coordinate depending on the width of the tooltip and the size of the parent container.
| top | number | -- | The vertical position of the cursor, tooltip will be place to the bottom or top of this coordinate depending on the height of the tooltip and the size of the parent container.
| offsetLeft | number | 10 | Horizontal offset of the tooltip from the passed `left` value, functions as a horizontal padding.
| offsetRight | number | 10 | Vertical offset of the tooltip from the passed `top` value, functions as a vertical padding.
| style | object | -- | Sets / overrides any styles on the tooltip container (including top and left)
| children | node | -- | Sets the children of the tooltip, i.e., the actual content

Note that this component is positioned using a `tranform`, so overriding `left` and `top` via styles may have no effect.
