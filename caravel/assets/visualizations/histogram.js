// JS
var d3 = window.d3 || require('d3')
var px = window.px || require('../javascripts/modules/caravel.js')


// CSS
require('./histogram.css')

function histogram(slice) {
    
    var div = d3.select(slice.selector)

    var _draw = function(data, form_data) {
        
        var margin = { top: 0, right: 0, bottom: 0, left: 0 },
            width = slice.width() - margin.left - margin.right,
            height = slice.height() - navBarHeight - navBarBuffer -
                margin.top - margin.bottom,
            formatNumber = d3.format(",.0f")

        var x = d3.scale.linear()
            .domain([0, width])
            .range([0, width])
        
        var bins = d3.histogram()
            .domain(x.domain())
            .thresholds(x.ticks(20))
            (data);

        var y = d3.scale.linear()
            .domain([0, d3.max(bins, function(d) { return d.length; })])
            .range([height, 0])

        var svg = div.append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
         .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        var bar = svg.selectAll(".bar")
            .data(bins)
         .enter().append("g")
            .attr("class", "bar")
            .attr("transform", function(d) { return "translate(" + x(d.x0) + "," + y(d.length) + ")"; });

        bar.append("rect")
            .attr("x", 1)
            .attr("width", x(bins[0].x1) - x(bins[0].x0) -1)
            .attr("height", function(d) { return height - y(d.length); });

        bar.append("text")
            .attr("dy", ".75em")
            .attr("y", 6)
            .attr("x", (x(bins[0].x1) - x(bins[0].x0)) / 2)
            .attr("text-anchor", "middle")
            .text(function(d) { return formatNumber(d.length); });

        svg.append("g")
            .attr("class", "axis axis--x")
            .attr("transform", "translate(0," + height + ")")
            .call(d3.axisBottom(x));

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

