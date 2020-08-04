nv.models.focus = function(content) {
    "use strict";

    //============================================================
    // Public Variables with Default Settings
    //------------------------------------------------------------

    var content = content || nv.models.line()
        , xAxis = nv.models.axis()
        , yAxis = nv.models.axis()
        , brush = d3.svg.brush()
        ;

    var margin = {top: 10, right: 0, bottom: 30, left: 0}
        , color = nv.utils.defaultColor()
        , width = null
        , height = 70
        , showXAxis = true
        , showYAxis = false
        , rightAlignYAxis = false
        , ticks = null
        , x
        , y
        , brushExtent = null
        , duration = 250
        , dispatch = d3.dispatch('brush', 'onBrush', 'renderEnd')
        , syncBrushing = true
        ;

    content.interactive(false);
    content.pointActive(function(d) { return false; });

    //============================================================
    // Private Variables
    //------------------------------------------------------------

    var renderWatch = nv.utils.renderWatch(dispatch, duration);

    function chart(selection) {
        renderWatch.reset();
        renderWatch.models(content);
        if (showXAxis) renderWatch.models(xAxis);
        if (showYAxis) renderWatch.models(yAxis);

        selection.each(function(data) {
            var container = d3.select(this);
            nv.utils.initSVG(container);
            var availableWidth = nv.utils.availableWidth(width, container, margin),
                availableHeight = height - margin.top - margin.bottom;

            chart.update = function() { 
                if( duration === 0 ) {
                    container.call( chart );
                } else {
                    container.transition().duration(duration).call(chart);
                }
            };
            chart.container = this;

            // Setup Scales
            x = content.xScale();
            y = content.yScale();

            // Setup containers and skeleton of chart
            var wrap = container.selectAll('g.nv-focus').data([data]);
            var gEnter = wrap.enter().append('g').attr('class', 'nvd3 nv-focus').append('g');
            var g = wrap.select('g');

            wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

            gEnter.append('g').attr('class', 'nv-background').append('rect');
            gEnter.append('g').attr('class', 'nv-x nv-axis');
            gEnter.append('g').attr('class', 'nv-y nv-axis');
            gEnter.append('g').attr('class', 'nv-contentWrap');
            gEnter.append('g').attr('class', 'nv-brushBackground');
            gEnter.append('g').attr('class', 'nv-x nv-brush');

            if (rightAlignYAxis) {
                g.select(".nv-y.nv-axis")
                    .attr("transform", "translate(" + availableWidth + ",0)");
            }

            g.select('.nv-background rect')
                .attr('width', availableWidth)
                .attr('height', availableHeight);
                
            content
                .width(availableWidth)
                .height(availableHeight)
                .color(data.map(function(d,i) {
                    return d.color || color(d, i);
                }).filter(function(d,i) { return !data[i].disabled; }));

            var contentWrap = g.select('.nv-contentWrap')
                .datum(data.filter(function(d) { return !d.disabled; }));

            d3.transition(contentWrap).call(content);
            
            // Setup Brush
            brush
                .x(x)
                .on('brush', function() {
                    onBrush(syncBrushing);
                });

            brush.on('brushend', function () {
                if (!syncBrushing) {
                    dispatch.onBrush(brush.empty() ? x.domain() : brush.extent());
                }
            });

            if (brushExtent) brush.extent(brushExtent);

            var brushBG = g.select('.nv-brushBackground').selectAll('g')
                .data([brushExtent || brush.extent()]);
    
            var brushBGenter = brushBG.enter()
                .append('g');

            brushBGenter.append('rect')
                .attr('class', 'left')
                .attr('x', 0)
                .attr('y', 0)
                .attr('height', availableHeight);

            brushBGenter.append('rect')
                .attr('class', 'right')
                .attr('x', 0)
                .attr('y', 0)
                .attr('height', availableHeight);

            var gBrush = g.select('.nv-x.nv-brush')
                .call(brush);
            gBrush.selectAll('rect')
                .attr('height', availableHeight);
            gBrush.selectAll('.resize').append('path').attr('d', resizePath);

            onBrush(true);

            g.select('.nv-background rect')
                .attr('width', availableWidth)
                .attr('height', availableHeight);

            if (showXAxis) {
                xAxis.scale(x)
                    ._ticks( nv.utils.calcTicksX(availableWidth/100, data) )
                    .tickSize(-availableHeight, 0);
  
                g.select('.nv-x.nv-axis')
                    .attr('transform', 'translate(0,' + y.range()[0] + ')');
                d3.transition(g.select('.nv-x.nv-axis'))
                    .call(xAxis);
            }

            if (showYAxis) {
                yAxis
                    .scale(y)
                    ._ticks( nv.utils.calcTicksY(availableHeight/36, data) )
                    .tickSize( -availableWidth, 0);

                d3.transition(g.select('.nv-y.nv-axis'))
                    .call(yAxis);
            }
            
            g.select('.nv-x.nv-axis')
                .attr('transform', 'translate(0,' + y.range()[0] + ')');

            //============================================================
            // Event Handling/Dispatching (in chart's scope)
            //------------------------------------------------------------

            //============================================================
            // Functions
            //------------------------------------------------------------
    
            // Taken from crossfilter (http://square.github.com/crossfilter/)
            function resizePath(d) {
                var e = +(d == 'e'),
                    x = e ? 1 : -1,
                    y = availableHeight / 3;
                return 'M' + (0.5 * x) + ',' + y
                    + 'A6,6 0 0 ' + e + ' ' + (6.5 * x) + ',' + (y + 6)
                    + 'V' + (2 * y - 6)
                    + 'A6,6 0 0 ' + e + ' ' + (0.5 * x) + ',' + (2 * y)
                    + 'Z'
                    + 'M' + (2.5 * x) + ',' + (y + 8)
                    + 'V' + (2 * y - 8)
                    + 'M' + (4.5 * x) + ',' + (y + 8)
                    + 'V' + (2 * y - 8);
            }
    
    
            function updateBrushBG() {
                if (!brush.empty()) brush.extent(brushExtent);
                brushBG
                    .data([brush.empty() ? x.domain() : brushExtent])
                    .each(function(d,i) {
                        var leftWidth = x(d[0]) - x.range()[0],
                            rightWidth = availableWidth - x(d[1]);
                        d3.select(this).select('.left')
                            .attr('width',  leftWidth < 0 ? 0 : leftWidth);
    
                        d3.select(this).select('.right')
                            .attr('x', x(d[1]))
                            .attr('width', rightWidth < 0 ? 0 : rightWidth);
                    });
            }


            function onBrush(shouldDispatch) {
                brushExtent = brush.empty() ? null : brush.extent();
                var extent = brush.empty() ? x.domain() : brush.extent();
                dispatch.brush({extent: extent, brush: brush});
                updateBrushBG();
                if (shouldDispatch) {
                    dispatch.onBrush(extent);
                }
            }
        });

        renderWatch.renderEnd('focus immediate');
        return chart;
    }


    //============================================================
    // Event Handling/Dispatching (out of chart's scope)
    //------------------------------------------------------------

    //============================================================
    // Expose Public Variables
    //------------------------------------------------------------

    // expose chart's sub-components
    chart.dispatch = dispatch;
    chart.content = content;
    chart.brush = brush;
    chart.xAxis = xAxis;
    chart.yAxis = yAxis;
    chart.options = nv.utils.optionsFunc.bind(chart);

    chart._options = Object.create({}, {
        // simple options, just get/set the necessary values
        width:      {get: function(){return width;}, set: function(_){width=_;}},
        height:     {get: function(){return height;}, set: function(_){height=_;}},
        showXAxis:      {get: function(){return showXAxis;}, set: function(_){showXAxis=_;}},
        showYAxis:    {get: function(){return showYAxis;}, set: function(_){showYAxis=_;}},
        brushExtent: {get: function(){return brushExtent;}, set: function(_){brushExtent=_;}},
        syncBrushing: {get: function(){return syncBrushing;}, set: function(_){syncBrushing=_;}},

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
            content.duration(duration);
            xAxis.duration(duration);
            yAxis.duration(duration);
        }},
        color:  {get: function(){return color;}, set: function(_){
            color = nv.utils.getColor(_);
            content.color(color);
        }},
        interpolate: {get: function(){return content.interpolate();}, set: function(_){
            content.interpolate(_);
        }},
        xTickFormat: {get: function(){return xAxis.tickFormat();}, set: function(_){
            xAxis.tickFormat(_);
        }},
        yTickFormat: {get: function(){return yAxis.tickFormat();}, set: function(_){
            yAxis.tickFormat(_);
        }},
        x: {get: function(){return content.x();}, set: function(_){
            content.x(_);
        }},
        y: {get: function(){return content.y();}, set: function(_){
            content.y(_);
        }},
        rightAlignYAxis: {get: function(){return rightAlignYAxis;}, set: function(_){
            rightAlignYAxis = _;
            yAxis.orient( rightAlignYAxis ? 'right' : 'left');
        }}
    });

    nv.utils.inheritOptions(chart, content);
    nv.utils.initOptions(chart);

    return chart;
};
