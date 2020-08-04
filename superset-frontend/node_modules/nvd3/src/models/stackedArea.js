
nv.models.stackedArea = function() {
    "use strict";

    //============================================================
    // Public Variables with Default Settings
    //------------------------------------------------------------

    var margin = {top: 0, right: 0, bottom: 0, left: 0}
        , width = 960
        , height = 500
        , color = nv.utils.defaultColor() // a function that computes the color
        , id = Math.floor(Math.random() * 100000) //Create semi-unique ID incase user doesn't selet one
        , container = null
        , getX = function(d) { return d.x } // accessor to get the x value from a data point
        , getY = function(d) { return d.y } // accessor to get the y value from a data point
        , defined = function(d,i) { return !isNaN(getY(d,i)) && getY(d,i) !== null } // allows a line to be not continuous when it is not defined
        , style = 'stack'
        , offset = 'zero'
        , order = 'default'
        , interpolate = 'linear'  // controls the line interpolation
        , clipEdge = false // if true, masks lines within x and y scale
        , x //can be accessed via chart.xScale()
        , y //can be accessed via chart.yScale()
        , scatter = nv.models.scatter()
        , duration = 250
        , dispatch =  d3.dispatch('areaClick', 'areaMouseover', 'areaMouseout','renderEnd', 'elementClick', 'elementMouseover', 'elementMouseout')
        ;

    scatter
        .pointSize(2.2) // default size
        .pointDomain([2.2, 2.2]) // all the same size by default
    ;

    /************************************
     * offset:
     *   'wiggle' (stream)
     *   'zero' (stacked)
     *   'expand' (normalize to 100%)
     *   'silhouette' (simple centered)
     *
     * order:
     *   'inside-out' (stream)
     *   'default' (input order)
     ************************************/

    var renderWatch = nv.utils.renderWatch(dispatch, duration);

    function chart(selection) {
        renderWatch.reset();
        renderWatch.models(scatter);
        selection.each(function(data) {
            var availableWidth = width - margin.left - margin.right,
                availableHeight = height - margin.top - margin.bottom;

            container = d3.select(this);
            nv.utils.initSVG(container);

            // Setup Scales
            x = scatter.xScale();
            y = scatter.yScale();

            var dataRaw = data;
            // Injecting point index into each point because d3.layout.stack().out does not give index
            data.forEach(function(aseries, i) {
                aseries.seriesIndex = i;
                aseries.values = aseries.values.map(function(d, j) {
                    d.index = j;
                    d.seriesIndex = i;
                    return d;
                });
            });

            var dataFiltered = data.filter(function(series) {
                return !series.disabled;
            });

            data = d3.layout.stack()
                .order(order)
                .offset(offset)
                .values(function(d) { return d.values })  //TODO: make values customizeable in EVERY model in this fashion
                .x(getX)
                .y(getY)
                .out(function(d, y0, y) {
                    d.display = {
                        y: y,
                        y0: y0
                    };
                })
            (dataFiltered);

            // Setup containers and skeleton of chart
            var wrap = container.selectAll('g.nv-wrap.nv-stackedarea').data([data]);
            var wrapEnter = wrap.enter().append('g').attr('class', 'nvd3 nv-wrap nv-stackedarea');
            var defsEnter = wrapEnter.append('defs');
            var gEnter = wrapEnter.append('g');
            var g = wrap.select('g');

            gEnter.append('g').attr('class', 'nv-areaWrap');
            gEnter.append('g').attr('class', 'nv-scatterWrap');

            wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
            
            // If the user has not specified forceY, make sure 0 is included in the domain
            // Otherwise, use user-specified values for forceY
            if (scatter.forceY().length == 0) {
                scatter.forceY().push(0);
            }
            
            scatter
                .width(availableWidth)
                .height(availableHeight)
                .x(getX)
                .y(function(d) {
                    if (d.display !== undefined) { return d.display.y + d.display.y0; }
                })
                .color(data.map(function(d,i) {
                    d.color = d.color || color(d, d.seriesIndex);
                    return d.color;
                }));

            var scatterWrap = g.select('.nv-scatterWrap')
                .datum(data);

            scatterWrap.call(scatter);

            defsEnter.append('clipPath')
                .attr('id', 'nv-edge-clip-' + id)
                .append('rect');

            wrap.select('#nv-edge-clip-' + id + ' rect')
                .attr('width', availableWidth)
                .attr('height', availableHeight);

            g.attr('clip-path', clipEdge ? 'url(#nv-edge-clip-' + id + ')' : '');

            var area = d3.svg.area()
                .defined(defined)
                .x(function(d,i)  { return x(getX(d,i)) })
                .y0(function(d) {
                    return y(d.display.y0)
                })
                .y1(function(d) {
                    return y(d.display.y + d.display.y0)
                })
                .interpolate(interpolate);

            var zeroArea = d3.svg.area()
                .defined(defined)
                .x(function(d,i)  { return x(getX(d,i)) })
                .y0(function(d) { return y(d.display.y0) })
                .y1(function(d) { return y(d.display.y0) });

            var path = g.select('.nv-areaWrap').selectAll('path.nv-area')
                .data(function(d) { return d });

            path.enter().append('path').attr('class', function(d,i) { return 'nv-area nv-area-' + i })
                .attr('d', function(d,i){
                    return zeroArea(d.values, d.seriesIndex);
                })
                .on('mouseover', function(d,i) {
                    d3.select(this).classed('hover', true);
                    dispatch.areaMouseover({
                        point: d,
                        series: d.key,
                        pos: [d3.event.pageX, d3.event.pageY],
                        seriesIndex: d.seriesIndex
                    });
                })
                .on('mouseout', function(d,i) {
                    d3.select(this).classed('hover', false);
                    dispatch.areaMouseout({
                        point: d,
                        series: d.key,
                        pos: [d3.event.pageX, d3.event.pageY],
                        seriesIndex: d.seriesIndex
                    });
                })
                .on('click', function(d,i) {
                    d3.select(this).classed('hover', false);
                    dispatch.areaClick({
                        point: d,
                        series: d.key,
                        pos: [d3.event.pageX, d3.event.pageY],
                        seriesIndex: d.seriesIndex
                    });
                });

            path.exit().remove();
            path.style('fill', function(d,i){
                    return d.color || color(d, d.seriesIndex)
                })
                .style('stroke', function(d,i){ return d.color || color(d, d.seriesIndex) });
            path.watchTransition(renderWatch,'stackedArea path')
                .attr('d', function(d,i) {
                    return area(d.values,i)
                });

            //============================================================
            // Event Handling/Dispatching (in chart's scope)
            //------------------------------------------------------------

            scatter.dispatch.on('elementMouseover.area', function(e) {
                g.select('.nv-chart-' + id + ' .nv-area-' + e.seriesIndex).classed('hover', true);
            });
            scatter.dispatch.on('elementMouseout.area', function(e) {
                g.select('.nv-chart-' + id + ' .nv-area-' + e.seriesIndex).classed('hover', false);
            });

            //Special offset functions
            chart.d3_stackedOffset_stackPercent = function(stackData) {
                var n = stackData.length,    //How many series
                    m = stackData[0].length,     //how many points per series
                    i,
                    j,
                    o,
                    y0 = [];

                for (j = 0; j < m; ++j) { //Looping through all points
                    for (i = 0, o = 0; i < dataRaw.length; i++) { //looping through all series
                        o += getY(dataRaw[i].values[j]); //total y value of all series at a certian point in time.
                    }

                    if (o) for (i = 0; i < n; i++) { //(total y value of all series at point in time i) != 0
                        stackData[i][j][1] /= o;
                    } else { //(total y value of all series at point in time i) == 0
                        for (i = 0; i < n; i++) {
                            stackData[i][j][1] = 0;
                        }
                    }
                }
                for (j = 0; j < m; ++j) y0[j] = 0;
                return y0;
            };

        });

        renderWatch.renderEnd('stackedArea immediate');
        return chart;
    }

    //============================================================
    // Global getters and setters
    //------------------------------------------------------------

    chart.dispatch = dispatch;
    chart.scatter = scatter;

    scatter.dispatch.on('elementClick', function(){ dispatch.elementClick.apply(this, arguments); });
    scatter.dispatch.on('elementMouseover', function(){ dispatch.elementMouseover.apply(this, arguments); });
    scatter.dispatch.on('elementMouseout', function(){ dispatch.elementMouseout.apply(this, arguments); });

    chart.interpolate = function(_) {
        if (!arguments.length) return interpolate;
        interpolate = _;
        return chart;
    };

    chart.duration = function(_) {
        if (!arguments.length) return duration;
        duration = _;
        renderWatch.reset(duration);
        scatter.duration(duration);
        return chart;
    };

    chart.dispatch = dispatch;
    chart.scatter = scatter;
    chart.options = nv.utils.optionsFunc.bind(chart);

    chart._options = Object.create({}, {
        // simple options, just get/set the necessary values
        width:      {get: function(){return width;}, set: function(_){width=_;}},
        height:     {get: function(){return height;}, set: function(_){height=_;}},
        defined: {get: function(){return defined;}, set: function(_){defined=_;}},
        clipEdge: {get: function(){return clipEdge;}, set: function(_){clipEdge=_;}},
        offset:      {get: function(){return offset;}, set: function(_){offset=_;}},
        order:    {get: function(){return order;}, set: function(_){order=_;}},
        interpolate:    {get: function(){return interpolate;}, set: function(_){interpolate=_;}},

        // simple functor options
        x:     {get: function(){return getX;}, set: function(_){getX = d3.functor(_);}},
        y:     {get: function(){return getY;}, set: function(_){getY = d3.functor(_);}},

        // options that require extra logic in the setter
        margin: {get: function(){return margin;}, set: function(_){
            margin.top    = _.top    !== undefined ? _.top    : margin.top;
            margin.right  = _.right  !== undefined ? _.right  : margin.right;
            margin.bottom = _.bottom !== undefined ? _.bottom : margin.bottom;
            margin.left   = _.left   !== undefined ? _.left   : margin.left;
        }},
        color:  {get: function(){return color;}, set: function(_){
            color = nv.utils.getColor(_);
        }},
        style: {get: function(){return style;}, set: function(_){
            style = _;
            switch (style) {
                case 'stack':
                    chart.offset('zero');
                    chart.order('default');
                    break;
                case 'stream':
                    chart.offset('wiggle');
                    chart.order('inside-out');
                    break;
                case 'stream-center':
                    chart.offset('silhouette');
                    chart.order('inside-out');
                    break;
                case 'expand':
                    chart.offset('expand');
                    chart.order('default');
                    break;
                case 'stack_percent':
                    chart.offset(chart.d3_stackedOffset_stackPercent);
                    chart.order('default');
                    break;
            }
        }},
        duration: {get: function(){return duration;}, set: function(_){
            duration = _;
            renderWatch.reset(duration);
            scatter.duration(duration);
        }}
    });

    nv.utils.inheritOptions(chart, scatter);
    nv.utils.initOptions(chart);

    return chart;
};
