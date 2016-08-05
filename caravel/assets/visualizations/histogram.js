// JS
var d3 = require('d3')
var px = window.px || require('../javascripts/modules/caravel.js')

// CSS
require('./histogram.css')

function histogram(slice) {
    
    var div = d3.select(slice.selector)
    
    var _draw = function(data, noOfBins) {
        
        var margin = { top: 50, right: 10, bottom: 20, left: 50 },
            navBarHeight = 36,
            navBarTitleSize = navBarHeight / 3,
            navBarBuffer = 10,
            width = slice.width() - margin.left - margin.right,
            height = slice.height() - margin.top - margin.bottom - navBarHeight - navBarBuffer,
            formatNumber = d3.format(",.0f"), 
            formatTicks = d3.format(",.00f");
        
        var bins = d3.layout.histogram().bins(noOfBins)(data),
            x = d3.scale.ordinal(),
            y = d3.scale.linear(),
            xAxis = d3.svg.axis().scale(x).orient("bottom").ticks(noOfBins).tickFormat(formatTicks),
            yAxis = d3.svg.axis().scale(y).orient("left").ticks(noOfBins*3);
 
        x.domain(bins.map(function(d) { return d.x;}))
         .rangeRoundBands([0, width], .1); 
        
        y.domain([0, d3.max(bins, function(d) { return d.y;})])
         .range([height, 0]);

        var svg = div.selectAll("svg").data([bins]).enter().append("svg");
        
        svg.append("rect")
           .attr("width", "100%")
           .attr("height", "100%")
           .attr("fill", "#f6f6f6");

        var gEnter = svg
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
        
        gEnter.append("g").attr("class", "bars");
        gEnter.append("g").attr("class", "x axis");

        svg.attr("width", slice.width())
           .attr("height", slice.height());
        
        var g = svg.select("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
        
        var bar = svg.select(".bars").selectAll(".bar").data(bins);
        bar.enter().append("rect");
        bar.exit().remove();
        bar .attr("width", x.rangeBand())
            .attr("x", function(d) { return x(d.x); })
            .attr("y", function(d) { return y(d.y); })
            .attr("height", function(d) {
                return y.range()[0] - y(d.y);
            })
            .attr("fill", function(d) { return px.color.category21(d.length); })
            .order();
       
       // Find maximum length to position the ticks on top of the bar correctly 
       var maxLength = d3.max(bins, function(d) { return d.length;});  
 
       svg.selectAll(".bartext")
          .data(bins)
          .enter()
          .append("text")
          .attr("class", "bartext")
          .attr("dy", ".75em")
          .attr("y", function(d) { 
            var padding = 0.0
            if (d.length/maxLength < 0.1) {
              padding = 12.0
            } else {
              padding = -8.0
            }
            return y(d.y) - padding;
          })
          .attr("x", function(d) { return x(d.x) + (x.rangeBand()/2);})
          .attr("text-anchor", "middle")
          .text(function(d) { return formatNumber(d.y); })
          .attr("fill", "black")
          .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
        
        // Update the x-axis 
        svg.append("g")
           .attr("class", "axis")
           .attr("transform", "translate(" + margin.left + "," + (height + margin.top) + ")")
           .text("values")
           .call(xAxis);
        
        // Update the Y Axis and add minor lines
        svg.append("g")
            .attr("class", "axis")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
            .text("count")
            .call(yAxis)
            .selectAll("g")
            .filter(function(d) { return d; })
            .classed("minor", true);
    };

    var render = function() {
    
        d3.json(slice.jsonEndpoint(), function(error, json) {
            if(error !== null) {
                slice.error(error.responseText, error);
                return '';
            }
            
            var noOfBins = Number(json.form_data.link_length) || 10;

            div.selectAll("*").remove();
            _draw(json.data, noOfBins);
            slice.done(json);
        });
    };

   return {
        render: render,
        resize: render
   };
}

module.exports = histogram;

