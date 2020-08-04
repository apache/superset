# @vx/boxplot

```
npm install --save @vx/boxplot
```

A boxplot shows the minimum, maximum, and quartiles of a dataset.

You can pass in props to target the `min`, `max`, `median`, and `box (interquartile range)` shapes using `minProps`, `maxProps`, `medianProps`, and `boxProps`.

If you are looking to add events over the each boxplot group you can pass in `container={true}` and `containerProps={{ /** */ }}`.

## <BoxPlot /> Properties

| Name              |Default| Type      | Description |
|:------------------|:------|:----------|:------------------------------|
| className         |       | string    | The className for the boxplot |
| left              | 0     | number    | The left offset of the boxplot |
| data              |       | array     | An array of data |
| max               |       | number    | The maximum value for boxplot |
| min               |       | number    | The minimum value for boxplot |
| firstQuartile     |       | number    | The value for the first quartile for the boxplot |
| thirdQuartile     |       | number    | The value for the third quartile for the boxplot |
| median            |       | number    | The median value for the boxplot |
| boxWidth          |       | number    | The width of the box |
| fill              |       | string    | The color of the box |
| fillOpacity       |       | number    | The opacity of the box |
| stroke            |       | string    | The color of the lines in boxplot |
| strokeWidth       |       | number    | Width of the lines in boxplot |
| rx                | 2     | number    | The [x-axis radius](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/rx) for the box |
| ry                | 2     | number    | The [y-axis radius](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/ry) for the box |
| container         | false | boolean   | Set to true and add `containerProps = {{ /** */}}` to add events to each boxplot group |
| maxProps          | {}    | object    | Props passed to target the `line` shape for the maximum |
| minProps          | {}    | object    | Props passed to target the `line` shape for the minimum |
| medianProps       | {}    | object    | Props passed to target the `line` shape for the median|
| boxProps          | {}    | object    | Props passed to target the `rect` shape for the box |
| containerProps    | {}    | object    | Props passed to add events over each boxplot group (requires `container={true}`) |
