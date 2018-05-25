/*
This expects data in the following format:
[
  {
    "key": "Series 1",
    "values": [ [ 1025409600000 , 0] ,
    [ 1028088000000 , -6.3382185140371] , ... ,
    [ 1330491600000 , 93.388148670744]
    ]
  },
  {
    "key": "Series 2",
    "values": [ [ 1025409600000 , 0] ,
    [ 1028088000000 , 0]  , ... ,
    [ 1330491600000 , -6.4417038470291]
    ]
  },
  {
    "key": "Series 3",
    "values": [
    [ 1025409600000 , 0] ,
    [ 1028088000000 , -6.3382185140371] , ... ,
    [ 1330491600000 , 86.946444823715]]
  }
]

==> Source: http://nvd3.org/examples/cumulativeLine.html

*/

import d3 from 'd3';
import nv from 'nvd3';


function percentageExceedenceVis(slice, payload) {
    const div = d3.select(slice.selector);
    // Define the percentage bounds that define color from red to green
    div.html(''); // reset
    const data = payload.data;
    const width1 = slice.width();
    const height1 = slice.height();
    const margin = { top: 20, right: 40, bottom: 40, left: 40 };
    const width = width1 - margin.left - margin.right;
    const height = height1 - margin.top - margin.bottom;
    const svg = div.append('svg')
        .attr('width', width)
        .attr('height', height);
    nv.addGraph(function () {
        const chart = nv.models.lineChart()
            .x(function (d) {
                return d[0] / 100;
            })
            .y(function (d) {
                return d[1];
            })
            .color(d3.scale.category10().range())
            .useInteractiveGuideline(true)
        ;
        chart.xAxis
            .tickFormat(d3.format('%'));

        chart.yAxis
            .tickFormat(d3.format('.f'));

        svg
            .datum(data)
            .call(chart);
        nv.utils.windowResize(chart.update);
        return chart;
    });
}

module.exports = percentageExceedenceVis;
