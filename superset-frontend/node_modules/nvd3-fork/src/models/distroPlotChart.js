nv.models.distroPlotChart = function() {
    "use strict";

    //============================================================
    // Public Variables with Default Settings
    //------------------------------------------------------------

    var distroplot = nv.models.distroPlot(),
        xAxis = nv.models.axis(),
        yAxis = nv.models.axis()

    var margin = {top: 25, right: 10, bottom: 40, left: 60},
        width = null,
        height = null,
        color = nv.utils.getColor(),
        showXAxis = true,
        showYAxis = true,
        rightAlignYAxis = false,
        staggerLabels = false,
        xLabel = false,
        yLabel = false,
        tooltip = nv.models.tooltip(),
        x, y,
        noData = 'No Data Available.',
        dispatch = d3.dispatch('stateChange', 'beforeUpdate', 'renderEnd'),
        duration = 500;

    xAxis
        .orient('bottom')
        .showMaxMin(false)
        .tickFormat(function(d) { return d })
    ;
    yAxis
        .orient((rightAlignYAxis) ? 'right' : 'left')
        .tickFormat(d3.format(',.1f'))
    ;

    tooltip.duration(0);


    //============================================================
    // Private Variables
    //------------------------------------------------------------

    var renderWatch = nv.utils.renderWatch(dispatch, duration);
    var colorGroup0, marginTop0 = margin.top, x0, y0, resolution0, bandwidth0, clampViolin0;
    var dataCache;


    // return true if data has changed somehow after
    // an .update() was called
    // works by comparing current data set to the
    // one previously cached
    // TODO - since we keep another version of the dataset
    // around for comparison, it doubles the memory usage :(
    function dataHasChanged(d) {
        if (arraysEqual(d, dataCache)) {
            return false;
        } else {
            dataCache = JSON.parse(JSON.stringify(d)) // deep copy
            return true;
        }
    }

    // return true if array of objects equivalent
    function arraysEqual(arr1, arr2) {
        if(arr1.length !== arr2.length) return false;

        for(var i = arr1.length; i--;) {
            if ('object_constancy' in arr1[i]) delete arr1[i].object_constancy
            if ('object_constancy' in arr2[i]) delete arr2[i].object_constancy

            if(!objectEquals(arr1[i], arr2[i])) {
                return false;
            }
        }

        return true;
    }

    // return true if objects are equivalent
    function objectEquals(a, b) {
        // Create arrays of property names
        var aProps = Object.getOwnPropertyNames(a);
        var bProps = Object.getOwnPropertyNames(b);

        // If number of properties is different,
        // objects are not equivalent
        if (aProps.length != bProps.length) {
            return false;
        }

        for (var i = 0; i < aProps.length; i++) {
            var propName = aProps[i];

            // If values of same property are not equal,
            // objects are not equivalent
            if (a[propName] !== b[propName]) {
                return false;
            }
        }

        return true;
    }


    function chart(selection) {
        renderWatch.reset();
        renderWatch.models(distroplot);
        if (showXAxis) renderWatch.models(xAxis);
        if (showYAxis) renderWatch.models(yAxis);

        selection.each(function(data) {
            var container = d3.select(this), that = this;
            nv.utils.initSVG(container);
            var availableWidth = (width  || parseInt(container.style('width')) || 960) - margin.left - margin.right;
            var availableHeight = (height || parseInt(container.style('height')) || 400) - margin.top - margin.bottom;

            if (typeof dataCache === 'undefined') {
                dataCache = JSON.parse(JSON.stringify(data)) // deep copy
            }

            chart.update = function() {
                dispatch.beforeUpdate();
                var opts = distroplot.options()
                if (colorGroup0 !== opts.colorGroup() || // recalc data when any of the axis accessors are changed
                    x0 !== opts.x() ||
                    y0 !== opts.y() ||
                    bandwidth0 !== opts.bandwidth() ||
                    resolution0 !== opts.resolution() ||
                    clampViolin0 !== opts.clampViolin() ||
                    dataHasChanged(data)
                ) {
                    distroplot.recalcData();
                }
                container.transition().duration(duration).call(chart);
            };
            chart.container = this;


            if (typeof d3.beeswarm !== 'function' && chart.options().observationType() == 'swarm') {
                var xPos = margin.left + availableWidth/2;
                noData = 'Please include the library https://github.com/Kcnarf/d3-beeswarm to use "swarm".'
                nv.utils.noData(chart, container);
                return chart;
            } else if (!data || !data.length) {
                nv.utils.noData(chart, container);
                return chart;
            } else {
                container.selectAll('.nv-noData').remove();
            }

            // Setup Scales
            x = distroplot.xScale();
            y = distroplot.yScale().clamp(true);

            // Setup containers and skeleton of chart
            var wrap = container.selectAll('g.nv-wrap.nv-distroPlot').data([data]);
            var gEnter = wrap.enter().append('g').attr('class', 'nvd3 nv-wrap nv-distroPlot').append('g');
            var defsEnter = gEnter.append('defs');
            var g = wrap.select('g');

            gEnter.append('g').attr('class', 'nv-x nv-axis');
            gEnter.append('g').attr('class', 'nv-y nv-axis')
                .append('g').attr('class', 'nv-zeroLine')
                .append('line');

            gEnter.append('g').attr('class', 'nv-distroWrap');
            gEnter.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
            g.watchTransition(renderWatch, 'nv-wrap: wrap')
                .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

            if (rightAlignYAxis) {
                g.select('.nv-y.nv-axis')
                    .attr('transform', 'translate(' + availableWidth + ',0)');
            }


            // Main Chart Component(s)
            distroplot.width(availableWidth).height(availableHeight);

            var distroWrap = g.select('.nv-distroWrap')
                .datum(data)

            distroWrap.transition().call(distroplot);

            defsEnter.append('clipPath')
                .attr('id', 'nv-x-label-clip-' + distroplot.id())
                .append('rect');

            g.select('#nv-x-label-clip-' + distroplot.id() + ' rect')
                .attr('width', x.rangeBand() * (staggerLabels ? 2 : 1))
                .attr('height', 16)
                .attr('x', -x.rangeBand() / (staggerLabels ? 1 : 2 ));

            // Setup Axes
            if (showXAxis) {
                xAxis
                    .scale(x)
                    .ticks( nv.utils.calcTicksX(availableWidth/100, data) )
                    .tickSize(-availableHeight, 0);

                g.select('.nv-x.nv-axis').attr('transform', 'translate(0,' + y.range()[0] + ')')
                g.select('.nv-x.nv-axis').call(xAxis);

                //g.select('.nv-x.nv-axis').select('.nv-axislabel')
                //    .style('font-size', d3.min([availableWidth * 0.05,20]) + 'px')

                var xTicks = g.select('.nv-x.nv-axis').selectAll('g');
                if (staggerLabels) {
                    xTicks
                        .selectAll('text')
                        .attr('transform', function(d,i,j) { return 'translate(0,' + (j % 2 === 0 ? '5' : '17') + ')' })
                }
            }

            if (showYAxis) {
                yAxis
                    .scale(y)
                    .ticks( Math.floor(availableHeight/36) ) // can't use nv.utils.calcTicksY with Object data
                    .tickSize( -availableWidth, 0);

                g.select('.nv-y.nv-axis').call(yAxis);

                //g.select('.nv-y.nv-axis').select('.nv-axislabel')
                //    .style('font-size', d3.min([availableHeight * 0.05,20]) + 'px')
            }




            // Zero line on chart bottom
            g.select('.nv-zeroLine line')
                .attr('x1',0)
                .attr('x2',availableWidth)
                .attr('y1', y(0))
                .attr('y2', y(0))
            ;

            // store original values so that we can
            // call 'recalcData()' if needed
            colorGroup0 = distroplot.options().colorGroup();
            x0 = distroplot.options().x();
            y0 = distroplot.options().y();
            bandwidth0 = distroplot.options().bandwidth();
            resolution0 = distroplot.options().resolution();
            clampViolin0 = distroplot.options().clampViolin();

            //============================================================
            // Event Handling/Dispatching (in chart's scope)
            //------------------------------------------------------------

        });

        renderWatch.renderEnd('nv-distroplot chart immediate');
        return chart;
    }

    //============================================================
    // Event Handling/Dispatching (out of chart's scope)
    //------------------------------------------------------------

    distroplot.dispatch.on('elementMouseover.tooltip', function(evt) {
        tooltip.data(evt).hidden(false);
    });

    distroplot.dispatch.on('elementMouseout.tooltip', function(evt) {
        tooltip.data(evt).hidden(true);
    });

    distroplot.dispatch.on('elementMousemove.tooltip', function(evt) {
        tooltip();
    });

    //============================================================
    // Expose Public Variables
    //------------------------------------------------------------

    chart.dispatch = dispatch;
    chart.distroplot = distroplot;
    chart.xAxis = xAxis;
    chart.yAxis = yAxis;
    chart.tooltip = tooltip;

    chart.options = nv.utils.optionsFunc.bind(chart);

    chart._options = Object.create({}, {
        // simple options, just get/set the necessary values
        width:      {get: function(){return width;}, set: function(_){width=_;}},
        height:     {get: function(){return height;}, set: function(_){height=_;}},
        staggerLabels: {get: function(){return staggerLabels;}, set: function(_){staggerLabels=_;}},
        showXAxis: {get: function(){return showXAxis;}, set: function(_){showXAxis=_;}},
        showYAxis: {get: function(){return showYAxis;}, set: function(_){showYAxis=_;}},
        tooltipContent:    {get: function(){return tooltip;}, set: function(_){tooltip=_;}},
        noData:    {get: function(){return noData;}, set: function(_){noData=_;}},
        defaultState:    {get: function(){return defaultState;}, set: function(_){defaultState=_;}},

        // options that require extra logic in the setter
        margin: {get: function(){return margin;}, set: function(_){
            margin.top    = _.top    !== undefined ? _.top    : margin.top;
            margin.right  = _.right  !== undefined ? _.right  : margin.right;
            margin.bottom = _.bottom !== undefined ? _.bottom : margin.bottom;
            margin.left   = _.left   !== undefined ? _.left   : margin.left;
        }},
        duration: {get: function(){return duration;}, set: function(_){
            duration = _;
            renderWatch.reset(duration);
            distroplot.duration(duration);
            xAxis.duration(duration);
            yAxis.duration(duration);
        }},
        color:  {get: function(){return color;}, set: function(_){
            color = nv.utils.getColor(_);
            distroplot.color(color);
        }},
        rightAlignYAxis: {get: function(){return rightAlignYAxis;}, set: function(_){
            rightAlignYAxis = _;
            yAxis.orient( (_) ? 'right' : 'left');
        }},
        xLabel:  {get: function(){return xLabel;}, set: function(_){
            xLabel=_;
            xAxis.axisLabel(xLabel);
        }},
        yLabel:  {get: function(){return yLabel;}, set: function(_){
            yLabel=_;
            yAxis.axisLabel(yLabel);
        }},
    });


    nv.utils.inheritOptions(chart, distroplot);
    nv.utils.initOptions(chart);

    return chart;
}
