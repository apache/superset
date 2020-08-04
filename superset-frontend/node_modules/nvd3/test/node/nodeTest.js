window.d3 = require('d3');
var nv = require('../../build/nv.d3');
var invariant = require('invariant');

window.addEventListener("load", function load(event) {
  window.removeEventListener("load", load, false);
  invariant(typeof(nv) !== 'undefined', "Cannot resolve NVD3 via CommonJS");
  nv.addGraph(function() {
    var chart = nv.models.bulletChart();
    d3.select('#chart svg')
        .datum(exampleData())
        .transition().duration(1000)
        .call(chart);
    return chart;
  });
}, false);

function exampleData() {
  return {
    "title":"Revenue",
    "subtitle":"US$, in thousands",
    "ranges":[150,225,300],
    "measures":[220],
    "markers":[250]
  }
}
