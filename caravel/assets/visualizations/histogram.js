// JS
var d3 = require('d3')
var px = window.px || require('../javascripts/modules/caravel.js')

// CSS
require('./histogram.css')

function histogram(slice) {
    
    var div = d3.select(slice.selector)

    var _draw = function(data, form_data) {
        
        var margin = { top: 0, right: 0, bottom: 0, left: 0 },
            width = slice.width() - margin.left - margin.right,
            height = slice.height() - margin.top - margin.bottom,
            formatNumber = d3.format(",.0f")
        
        var bins = d3.layout.histogram()
            (data);

        var x = d3.scale.linear()
            .domain(bins.map(function(d) { return d.x; }))
            .range([0, width]);
        
        var y = d3.scale.linear()
            .domain([0, d3.max(bins, function(d) { return d.y; })])
            .range([height, 0])
        
        var xAxis = d3.svg.axis().scale(x).orient("bottom").tickSize(6, 0);

        var svg = div.append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
         .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        var bar = svg.selectAll(".bar")
            .data(bins)
         .enter().append("g")
            .attr("class", "bar")
            .attr("transform", function(d) { 
                return "translate(" + x(d.x) + "," + y(d.y) + ")"; 
            });

        bar.append("rect")
            .attr("width", 1.0)
            .attr("x", function(d) { return x(d.x); })
            .attr("y", function(d) { return y(d.y); })
            .attr("height", function(d) { return y.range()[0] - y(d.y); })
            .order();

        bar.append("text")
            .attr("dy", ".75em")
            .attr("y", 6)
            .attr("x", (x(bins[0].x) - x(bins[0].y)) / 2)
            .attr("text-anchor", "middle")
            .text(function(d) { return formatNumber(d.length); });

        svg.append("g")
            .select(".x.axis")
            .attr("transform", "translate(0," + y.range()[0] + ")")
            .call(xAxis);

        slice.done(json); 
    };

    var render = function() {
    
        d3.json(slice.jsonEndpoint(), function(error, json) {
            if(error !== null) {
                slice.error(error.responseText, error);
                return '';
            }

            div.selectAll("*").remove();
            _draw(json.data, json.form_data);
            slice.done(json);
        
        });
    };

   return {
        render: render,
        resize: render
   }
}

module.exports = histogram;

