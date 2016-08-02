// JS
var d3 = require('d3')
var px = window.px || require('../javascripts/modules/caravel.js')

// CSS
require('./histogram.css')

function histogram(slice) {
    
    var div = d3.select(slice.selector)
    
    function irwinHallDistribution(n, m) {
          var distribution = [];
            for (var i = 0; i < n; i++) {
                    for (var s = 0, j = 0; j < m; j++) {
                              s += Math.random();
                                  }
                                      distribution.push(s / m);
                                        }
                                          return distribution;
    }

    var _draw_test = function(data, form_data) {
    
    }
    var _draw = function(data, form_data) {
        
        var margin = { top: 0, right: 0, bottom: 0, left: 0 },
            navBarHeight = 36,
            navBarTitleSize = navBarHeight / 3,
            navBarBuffer = 10,
            width = slice.width() - margin.left - margin.right,
            height = slice.height() - margin.top - margin.bottom - navBarHeight - navBarBuffer,
            formatNumber = d3.format(",.0f"); 
       
        var bins = d3.layout.histogram()(data);
        
        console.log(bins);
        
         var x = d3.scale.ordinal()
            .domain(bins.map(function(d) { return d.x; }))
            .rangeRoundBands([0, width], .1);
        
        var y = d3.scale.linear()
            .domain([0, d3.max(bins, function(d) { return d.y;})])
            .range([0, height]);
        
        var xAxis = d3.svg.axis().scale(x).orient("bottom").tickSize(6, 0);
        
        // Update the outer dimentsions
        var svg = div.append("svg")
            .attr("width", width)
            .attr("height", height)
            .data([bins]) 
        
        // Otherwise create the 
        var _g = svg.append("g");
        _g.append("g").attr("class", "bars");
        _g.append("g").attr("class", "x axis");
        
      
        // Update the inner dimentions
        var g  = svg.select("g")
           .attr("transform", "translate(" + margin.left + "," + (margin.top + navBarHeight + navBarBuffer) + ")");
        
        // Update the bars
        var bar = svg.select(".bars").selectAll(".bar").data(bins);
        bar.enter().append("rect");
        bar.exit().remove();

        bar.attr("width", x.rangeBand())
            .attr("x", function(d) { return x(d.x); })
            .attr("y", function(d) { return y(d.y); })
            .attr("height", function(d) {
                return y.range()[1] - y(d.y);
            }).order();
         
        // Update the x-axis 
        g.select(".x.axis")
         .attr("transform", "translate(0," + y.range()[1] + ")")
         .call(xAxis);
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
   };
}

module.exports = histogram;

