
nv.models.distribution = function() {
    "use strict";
    //============================================================
    // Public Variables with Default Settings
    //------------------------------------------------------------

    var margin = {top: 0, right: 0, bottom: 0, left: 0}
        , width = 400 //technically width or height depending on x or y....
        , size = 8
        , axis = 'x' // 'x' or 'y'... horizontal or vertical
        , getData = function(d) { return d[axis] }  // defaults d.x or d.y
        , color = nv.utils.defaultColor()
        , scale = d3.scale.linear()
        , domain
        , duration = 250
        , dispatch = d3.dispatch('renderEnd')
        ;

    //============================================================


    //============================================================
    // Private Variables
    //------------------------------------------------------------

    var scale0;
    var renderWatch = nv.utils.renderWatch(dispatch, duration);

    //============================================================


    function chart(selection) {
        renderWatch.reset();
        selection.each(function(data) {
            var availableLength = width - (axis === 'x' ? margin.left + margin.right : margin.top + margin.bottom),
                naxis = axis == 'x' ? 'y' : 'x',
                container = d3.select(this);
            nv.utils.initSVG(container);

            //------------------------------------------------------------
            // Setup Scales

            scale0 = scale0 || scale;

            //------------------------------------------------------------


            //------------------------------------------------------------
            // Setup containers and skeleton of chart

            var wrap = container.selectAll('g.nv-distribution').data([data]);
            var wrapEnter = wrap.enter().append('g').attr('class', 'nvd3 nv-distribution');
            var gEnter = wrapEnter.append('g');
            var g = wrap.select('g');

            wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')

            //------------------------------------------------------------


            var distWrap = g.selectAll('g.nv-dist')
                .data(function(d) { return d }, function(d) { return d.key });

            distWrap.enter().append('g');
            distWrap
                .attr('class', function(d,i) { return 'nv-dist nv-series-' + i })
                .style('stroke', function(d,i) { return color(d, i) });

            var dist = distWrap.selectAll('line.nv-dist' + axis)
                .data(function(d) { return d.values })
            dist.enter().append('line')
                .attr(axis + '1', function(d,i) { return scale0(getData(d,i)) })
                .attr(axis + '2', function(d,i) { return scale0(getData(d,i)) })
            renderWatch.transition(distWrap.exit().selectAll('line.nv-dist' + axis), 'dist exit')
                // .transition()
                .attr(axis + '1', function(d,i) { return scale(getData(d,i)) })
                .attr(axis + '2', function(d,i) { return scale(getData(d,i)) })
                .style('stroke-opacity', 0)
                .remove();
            dist
                .attr('class', function(d,i) { return 'nv-dist' + axis + ' nv-dist' + axis + '-' + i })
                .attr(naxis + '1', 0)
                .attr(naxis + '2', size);
            renderWatch.transition(dist, 'dist')
                // .transition()
                .attr(axis + '1', function(d,i) { return scale(getData(d,i)) })
                .attr(axis + '2', function(d,i) { return scale(getData(d,i)) })


            scale0 = scale.copy();

        });
        renderWatch.renderEnd('distribution immediate');
        return chart;
    }


    //============================================================
    // Expose Public Variables
    //------------------------------------------------------------
    chart.options = nv.utils.optionsFunc.bind(chart);
    chart.dispatch = dispatch;

    chart.margin = function(_) {
        if (!arguments.length) return margin;
        margin.top    = typeof _.top    != 'undefined' ? _.top    : margin.top;
        margin.right  = typeof _.right  != 'undefined' ? _.right  : margin.right;
        margin.bottom = typeof _.bottom != 'undefined' ? _.bottom : margin.bottom;
        margin.left   = typeof _.left   != 'undefined' ? _.left   : margin.left;
        return chart;
    };

    chart.width = function(_) {
        if (!arguments.length) return width;
        width = _;
        return chart;
    };

    chart.axis = function(_) {
        if (!arguments.length) return axis;
        axis = _;
        return chart;
    };

    chart.size = function(_) {
        if (!arguments.length) return size;
        size = _;
        return chart;
    };

    chart.getData = function(_) {
        if (!arguments.length) return getData;
        getData = d3.functor(_);
        return chart;
    };

    chart.scale = function(_) {
        if (!arguments.length) return scale;
        scale = _;
        return chart;
    };

    chart.color = function(_) {
        if (!arguments.length) return color;
        color = nv.utils.getColor(_);
        return chart;
    };

    chart.duration = function(_) {
        if (!arguments.length) return duration;
        duration = _;
        renderWatch.reset(duration);
        return chart;
    };
    //============================================================


    return chart;
}
