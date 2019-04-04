# d3-legend

Full documentation: [http://d3-legend.susielu.com](http://d3-legend.susielu.com)

## Usage

### Using just the minified file


You must inclue the [d3 library](http://d3js.org/) before including the legend file. Then you can simply add the compiled js file to your website:

- d3-legend.min.js
- d3-legend.js (Human readable version)

### Using CDN

You can also add latest version of [d3-legend hosted on cdnjs](https://cdnjs.com/libraries/d3-legend).

### Using npm

Already using d3? Great! You can add the d3 legend as a node module by running:

`npm i d3-svg-legend -S`

If not, install both this way:

`npm i d3@^3.0.0 d3-svg-legend -S`

Please note, d3 is now a peer dependency, you will have to have the npm d3 module separately. This component works with any 3.x version of d3.

If you `require('d3-svg-legend')` we attach to d3 as `d3.legend`. If you'd like to use d3-legend without extending d3, `require('d3-svg-legend/no-extend')`. For example:
```
var d3 = require('d3')
var legend = require('d3-svg-legend/no-extend')

var svg = d3.select("#svg-color-quant");

var quantize = d3.scale.quantize()
    .domain([ 0, 0.15 ])
    .range(d3.range(9).map(function(i) { return "q" + i + "-9"; }));

svg.append("g")
  .attr("class", "legendQuant")
  .attr("transform", "translate(20,20)");

var colorLegend = legend.color()
    .labelFormat(d3.format(".2f"))
    .useClass(true)
    .scale(quantize);

svg.select(".legendQuant")
  .call(colorLegend);

```

## Feedback
I would love to hear from you about any additional features that would be useful, please say hi on twitter [@DataToViz](https://www.twitter.com/DataToViz).