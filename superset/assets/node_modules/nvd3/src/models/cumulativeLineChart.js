
nv.models.cumulativeLineChart = function() {
    "use strict";

    //============================================================
    // Public Variables with Default Settings
    //------------------------------------------------------------

    var lines = nv.models.line()
        , xAxis = nv.models.axis()
        , yAxis = nv.models.axis()
        , legend = nv.models.legend()
        , controls = nv.models.legend()
        , interactiveLayer = nv.interactiveGuideline()
        , tooltip = nv.models.tooltip()
        ;

    var margin = {top: 30, right: 30, bottom: 50, left: 60}
        , marginTop = null
        , color = nv.utils.defaultColor()
        , width = null
        , height = null
        , showLegend = true
        , showXAxis = true
        , showYAxis = true
        , rightAlignYAxis = false
        , showControls = true
        , useInteractiveGuideline = false
        , rescaleY = true
        , x //can be accessed via chart.xScale()
        , y //can be accessed via chart.yScale()
        , id = lines.id()
        , state = nv.utils.state()
        , defaultState = null
        , noData = null
        , average = function(d) { return d.average }
        , dispatch = d3.dispatch('stateChange', 'changeState', 'renderEnd')
        , transitionDuration = 250
        , duration = 250
        , noErrorCheck = false  //if set to TRUE, will bypass an error check in the indexify function.
        ;

    state.index = 0;
    state.rescaleY = rescaleY;

    xAxis.orient('bottom').tickPadding(7);
    yAxis.orient((rightAlignYAxis) ? 'right' : 'left');

    tooltip.valueFormatter(function(d, i) {
        return yAxis.tickFormat()(d, i);
    }).headerFormatter(function(d, i) {
        return xAxis.tickFormat()(d, i);
    });

    controls.updateState(false);

    //============================================================
    // Private Variables
    //------------------------------------------------------------

    var dx = d3.scale.linear()
        , index = {i: 0, x: 0}
        , renderWatch = nv.utils.renderWatch(dispatch, duration)
        , currentYDomain
        ;

    var stateGetter = function(data) {
        return function(){
            return {
                active: data.map(function(d) { return !d.disabled }),
                index: index.i,
                rescaleY: rescaleY
            };
        }
    };

    var stateSetter = function(data) {
        return function(state) {
            if (state.index !== undefined)
                index.i = state.index;
            if (state.rescaleY !== undefined)
                rescaleY = state.rescaleY;
            if (state.active !== undefined)
                data.forEach(function(series,i) {
                    series.disabled = !state.active[i];
                });
        }
    };

    function chart(selection) {
        renderWatch.reset();
        renderWatch.models(lines);
        if (showXAxis) renderWatch.models(xAxis);
        if (showYAxis) renderWatch.models(yAxis);
        selection.each(function(data) {
            var container = d3.select(this);
            nv.utils.initSVG(container);
            container.classed('nv-chart-' + id, true);
            var that = this;

            var availableWidth = nv.utils.availableWidth(width, container, margin),
                availableHeight = nv.utils.availableHeight(height, container, margin);

            chart.update = function() {
                if (duration === 0)
                    container.call(chart);
                else
                    container.transition().duration(duration).call(chart)
            };
            chart.container = this;

            state
                .setter(stateSetter(data), chart.update)
                .getter(stateGetter(data))
                .update();

            // DEPRECATED set state.disableddisabled
            state.disabled = data.map(function(d) { return !!d.disabled });

            if (!defaultState) {
                var key;
                defaultState = {};
                for (key in state) {
                    if (state[key] instanceof Array)
                        defaultState[key] = state[key].slice(0);
                    else
                        defaultState[key] = state[key];
                }
            }

            var indexDrag = d3.behavior.drag()
                .on('dragstart', dragStart)
                .on('drag', dragMove)
                .on('dragend', dragEnd);


            function dragStart(d,i) {
                d3.select(chart.container)
                    .style('cursor', 'ew-resize');
            }

            function dragMove(d,i) {
                index.x = d3.event.x;
                index.i = Math.round(dx.invert(index.x));
                updateZero();
            }

            function dragEnd(d,i) {
                d3.select(chart.container)
                    .style('cursor', 'auto');

                // update state and send stateChange with new index
                state.index = index.i;
                dispatch.stateChange(state);
            }

            // Display No Data message if there's nothing to show.
            if (!data || !data.length || !data.filter(function(d) { return d.values.length }).length) {
                nv.utils.noData(chart, container)
                return chart;
            } else {
                container.selectAll('.nv-noData').remove();
            }

            // Setup Scales
            x = lines.xScale();
            y = lines.yScale();


            dx.domain([0, data[0].values.length - 1]) //Assumes all series have same length
                .range([0, availableWidth])
                .clamp(true);

            var data = indexify(index.i, data);

            // initialize the starting yDomain for the not-rescale case after indexify (to have calculated point.display)
            if (typeof(currentYDomain) === "undefined") {
                currentYDomain = getCurrentYDomain(data);
            }

            if (!rescaleY) {
                lines.yDomain(currentYDomain);
                lines.clipEdge(true);
            } else {
                lines.yDomain(null);
            }

            // Setup containers and skeleton of chart
            var interactivePointerEvents = (useInteractiveGuideline) ? "none" : "all";
            var wrap = container.selectAll('g.nv-wrap.nv-cumulativeLine').data([data]);
            var gEnter = wrap.enter().append('g').attr('class', 'nvd3 nv-wrap nv-cumulativeLine').append('g');
            var g = wrap.select('g');

            gEnter.append('g').attr('class', 'nv-interactive');
            gEnter.append('g').attr('class', 'nv-x nv-axis').style("pointer-events","none");
            gEnter.append('g').attr('class', 'nv-y nv-axis');
            gEnter.append('g').attr('class', 'nv-background');
            gEnter.append('g').attr('class', 'nv-linesWrap').style("pointer-events",interactivePointerEvents);
            gEnter.append('g').attr('class', 'nv-avgLinesWrap').style("pointer-events","none");
            gEnter.append('g').attr('class', 'nv-legendWrap');
            gEnter.append('g').attr('class', 'nv-controlsWrap');

            // Legend
            if (!showLegend) {
                g.select('.nv-legendWrap').selectAll('*').remove();
            } else {
                legend.width(availableWidth);

                g.select('.nv-legendWrap')
                    .datum(data)
                    .call(legend);

                if (!marginTop && legend.height() !== margin.top) {
                    margin.top = legend.height();
                    availableHeight = nv.utils.availableHeight(height, container, margin);
                }

                g.select('.nv-legendWrap')
                    .attr('transform', 'translate(0,' + (-margin.top) +')')
            }

            // Controls
            if (!showControls) {
                 g.select('.nv-controlsWrap').selectAll('*').remove();
            } else {
                var controlsData = [
                    { key: 'Re-scale y-axis', disabled: !rescaleY }
                ];

                controls
                    .width(140)
                    .color(['#444', '#444', '#444'])
                    .rightAlign(false)
                    .margin({top: 5, right: 0, bottom: 5, left: 20})
                ;

                g.select('.nv-controlsWrap')
                    .datum(controlsData)
                    .attr('transform', 'translate(0,' + (-margin.top) +')')
                    .call(controls);
            }

            wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

            if (rightAlignYAxis) {
                g.select(".nv-y.nv-axis")
                    .attr("transform", "translate(" + availableWidth + ",0)");
            }

            // Show error if index point value is 0 (division by zero avoided)
            var tempDisabled = data.filter(function(d) { return d.tempDisabled });

            wrap.select('.tempDisabled').remove(); //clean-up and prevent duplicates
            if (tempDisabled.length) {
                wrap.append('text').attr('class', 'tempDisabled')
                    .attr('x', availableWidth / 2)
                    .attr('y', '-.71em')
                    .style('text-anchor', 'end')
                    .text(tempDisabled.map(function(d) { return d.key }).join(', ') + ' values cannot be calculated for this time period.');
            }

            //Set up interactive layer
            if (useInteractiveGuideline) {
                interactiveLayer
                    .width(availableWidth)
                    .height(availableHeight)
                    .margin({left:margin.left,top:margin.top})
                    .svgContainer(container)
                    .xScale(x);
                wrap.select(".nv-interactive").call(interactiveLayer);
            }

            gEnter.select('.nv-background')
                .append('rect');

            g.select('.nv-background rect')
                .attr('width', availableWidth)
                .attr('height', availableHeight);

            lines
                //.x(function(d) { return d.x })
                .y(function(d) { return d.display.y })
                .width(availableWidth)
                .height(availableHeight)
                .color(data.map(function(d,i) {
                    return d.color || color(d, i);
                }).filter(function(d,i) { return !data[i].disabled && !data[i].tempDisabled; }));

            var linesWrap = g.select('.nv-linesWrap')
                .datum(data.filter(function(d) { return  !d.disabled && !d.tempDisabled }));

            linesWrap.call(lines);

            //Store a series index number in the data array.
            data.forEach(function(d,i) {
                d.seriesIndex = i;
            });

            var avgLineData = data.filter(function(d) {
                return !d.disabled && !!average(d);
            });

            var avgLines = g.select(".nv-avgLinesWrap").selectAll("line")
                .data(avgLineData, function(d) { return d.key; });

            var getAvgLineY = function(d) {
                //If average lines go off the svg element, clamp them to the svg bounds.
                var yVal = y(average(d));
                if (yVal < 0) return 0;
                if (yVal > availableHeight) return availableHeight;
                return yVal;
            };

            avgLines.enter()
                .append('line')
                .style('stroke-width',2)
                .style('stroke-dasharray','10,10')
                .style('stroke',function (d,i) {
                    return lines.color()(d,d.seriesIndex);
                })
                .attr('x1',0)
                .attr('x2',availableWidth)
                .attr('y1', getAvgLineY)
                .attr('y2', getAvgLineY);

            avgLines
                .style('stroke-opacity',function(d){
                    //If average lines go offscreen, make them transparent
                    var yVal = y(average(d));
                    if (yVal < 0 || yVal > availableHeight) return 0;
                    return 1;
                })
                .attr('x1',0)
                .attr('x2',availableWidth)
                .attr('y1', getAvgLineY)
                .attr('y2', getAvgLineY);

            avgLines.exit().remove();

            //Create index line
            var indexLine = linesWrap.selectAll('.nv-indexLine')
                .data([index]);
            indexLine.enter().append('rect').attr('class', 'nv-indexLine')
                .attr('width', 3)
                .attr('x', -2)
                .attr('fill', 'red')
                .attr('fill-opacity', .5)
                .style("pointer-events","all")
                .call(indexDrag);

            indexLine
                .attr('transform', function(d) { return 'translate(' + dx(d.i) + ',0)' })
                .attr('height', availableHeight);

            // Setup Axes
            if (showXAxis) {
                xAxis
                    .scale(x)
                    ._ticks( nv.utils.calcTicksX(availableWidth/70, data) )
                    .tickSize(-availableHeight, 0);

                g.select('.nv-x.nv-axis')
                    .attr('transform', 'translate(0,' + y.range()[0] + ')');
                g.select('.nv-x.nv-axis')
                    .call(xAxis);
            }

            if (showYAxis) {
                yAxis
                    .scale(y)
                    ._ticks( nv.utils.calcTicksY(availableHeight/36, data) )
                    .tickSize( -availableWidth, 0);

                g.select('.nv-y.nv-axis')
                    .call(yAxis);
            }

            //============================================================
            // Event Handling/Dispatching (in chart's scope)
            //------------------------------------------------------------

            function updateZero() {
                indexLine
                    .data([index]);

                //When dragging the index line, turn off line transitions.
                // Then turn them back on when done dragging.
                var oldDuration = chart.duration();
                chart.duration(0);
                chart.update();
                chart.duration(oldDuration);
            }

            g.select('.nv-background rect')
                .on('click', function() {
                    index.x = d3.mouse(this)[0];
                    index.i = Math.round(dx.invert(index.x));

                    // update state and send stateChange with new index
                    state.index = index.i;
                    dispatch.stateChange(state);

                    updateZero();
                });

            lines.dispatch.on('elementClick', function(e) {
                index.i = e.pointIndex;
                index.x = dx(index.i);

                // update state and send stateChange with new index
                state.index = index.i;
                dispatch.stateChange(state);

                updateZero();
            });

            controls.dispatch.on('legendClick', function(d,i) {
                d.disabled = !d.disabled;
                rescaleY = !d.disabled;
                state.rescaleY = rescaleY;
                if (!rescaleY) {
                    currentYDomain = getCurrentYDomain(data); // rescale is turned off, so set the currentYDomain
                }
                dispatch.stateChange(state);
                chart.update();
            });

            legend.dispatch.on('stateChange', function(newState) {
                for (var key in newState)
                    state[key] = newState[key];
                dispatch.stateChange(state);
                chart.update();
            });

            interactiveLayer.dispatch.on('elementMousemove', function(e) {
                lines.clearHighlights();
                var singlePoint, pointIndex, pointXLocation, allData = [];

                data
                    .filter(function(series, i) {
                        series.seriesIndex = i;
                        return !(series.disabled || series.tempDisabled);
                    })
                    .forEach(function(series,i) {
                        pointIndex = nv.interactiveBisect(series.values, e.pointXValue, chart.x());
                        lines.highlightPoint(i, pointIndex, true);
                        var point = series.values[pointIndex];
                        if (typeof point === 'undefined') return;
                        if (typeof singlePoint === 'undefined') singlePoint = point;
                        if (typeof pointXLocation === 'undefined') pointXLocation = chart.xScale()(chart.x()(point,pointIndex));
                        allData.push({
                            key: series.key,
                            value: chart.y()(point, pointIndex),
                            color: color(series,series.seriesIndex)
                        });
                    });

                //Highlight the tooltip entry based on which point the mouse is closest to.
                if (allData.length > 2) {
                    var yValue = chart.yScale().invert(e.mouseY);
                    var domainExtent = Math.abs(chart.yScale().domain()[0] - chart.yScale().domain()[1]);
                    var threshold = 0.03 * domainExtent;
                    var indexToHighlight = nv.nearestValueIndex(allData.map(function(d){return d.value}),yValue,threshold);
                    if (indexToHighlight !== null)
                        allData[indexToHighlight].highlight = true;
                }

                var xValue = xAxis.tickFormat()(chart.x()(singlePoint,pointIndex), pointIndex);
                interactiveLayer.tooltip
                    .valueFormatter(function(d,i) {
                        return yAxis.tickFormat()(d);
                    })
                    .data(
                    {
                        value: xValue,
                        series: allData
                    }
                )();

                interactiveLayer.renderGuideLine(pointXLocation);
            });

            interactiveLayer.dispatch.on("elementMouseout",function(e) {
                lines.clearHighlights();
            });

            // Update chart from a state object passed to event handler
            dispatch.on('changeState', function(e) {
                if (typeof e.disabled !== 'undefined') {
                    data.forEach(function(series,i) {
                        series.disabled = e.disabled[i];
                    });

                    state.disabled = e.disabled;
                }

                if (typeof e.index !== 'undefined') {
                    index.i = e.index;
                    index.x = dx(index.i);

                    state.index = e.index;

                    indexLine
                        .data([index]);
                }

                if (typeof e.rescaleY !== 'undefined') {
                    rescaleY = e.rescaleY;
                }

                chart.update();
            });

        });

        renderWatch.renderEnd('cumulativeLineChart immediate');

        return chart;
    }

    //============================================================
    // Event Handling/Dispatching (out of chart's scope)
    //------------------------------------------------------------

    lines.dispatch.on('elementMouseover.tooltip', function(evt) {
        var point = {
            x: chart.x()(evt.point),
            y: chart.y()(evt.point),
            color: evt.point.color
        };
        evt.point = point;
        tooltip.data(evt).hidden(false);
    });

    lines.dispatch.on('elementMouseout.tooltip', function(evt) {
        tooltip.hidden(true)
    });

    //============================================================
    // Functions
    //------------------------------------------------------------

    var indexifyYGetter = null;
    /* Normalize the data according to an index point. */
    function indexify(idx, data) {
        if (!indexifyYGetter) indexifyYGetter = lines.y();
        return data.map(function(line, i) {
            if (!line.values) {
                return line;
            }
            var indexValue = line.values[idx];
            if (indexValue == null) {
                return line;
            }
            var v = indexifyYGetter(indexValue, idx);

            // avoid divide by zero
            if (Math.abs(v) < 0.00001 && !noErrorCheck) {
                line.tempDisabled = true;
                return line;
            }

            line.tempDisabled = false;

            line.values = line.values.map(function(point, pointIndex) {
                point.display = {'y': (indexifyYGetter(point, pointIndex) - v) / v };
                return point;
            });

            return line;
        })
    }

    function getCurrentYDomain(data) {
        var seriesDomains = data
            .filter(function(series) { return !(series.disabled || series.tempDisabled)})
            .map(function(series,i) {
                return d3.extent(series.values, function (d) { return d.display.y });
            });

        return [
            d3.min(seriesDomains, function(d) { return d[0] }),
            d3.max(seriesDomains, function(d) { return d[1] })
        ];
    }

    //============================================================
    // Expose Public Variables
    //------------------------------------------------------------

    // expose chart's sub-components
    chart.dispatch = dispatch;
    chart.lines = lines;
    chart.legend = legend;
    chart.controls = controls;
    chart.xAxis = xAxis;
    chart.yAxis = yAxis;
    chart.interactiveLayer = interactiveLayer;
    chart.state = state;
    chart.tooltip = tooltip;

    chart.options = nv.utils.optionsFunc.bind(chart);

    chart._options = Object.create({}, {
        // simple options, just get/set the necessary values
        width:      {get: function(){return width;}, set: function(_){width=_;}},
        height:     {get: function(){return height;}, set: function(_){height=_;}},
        showControls:     {get: function(){return showControls;}, set: function(_){showControls=_;}},
        showLegend: {get: function(){return showLegend;}, set: function(_){showLegend=_;}},
        average: {get: function(){return average;}, set: function(_){average=_;}},
        defaultState:    {get: function(){return defaultState;}, set: function(_){defaultState=_;}},
        noData:    {get: function(){return noData;}, set: function(_){noData=_;}},
        showXAxis:    {get: function(){return showXAxis;}, set: function(_){showXAxis=_;}},
        showYAxis:    {get: function(){return showYAxis;}, set: function(_){showYAxis=_;}},
        noErrorCheck:    {get: function(){return noErrorCheck;}, set: function(_){noErrorCheck=_;}},

        // options that require extra logic in the setter
        rescaleY:     {get: function(){return rescaleY;}, set: function(_){
            rescaleY = _;
            chart.state.rescaleY = _; // also update state
        }},
        margin: {get: function(){return margin;}, set: function(_){
            if (_.top !== undefined) {
                margin.top = _.top;
                marginTop = _.top;
            }
            margin.right  = _.right  !== undefined ? _.right  : margin.right;
            margin.bottom = _.bottom !== undefined ? _.bottom : margin.bottom;
            margin.left   = _.left   !== undefined ? _.left   : margin.left;
        }},
        color:  {get: function(){return color;}, set: function(_){
            color = nv.utils.getColor(_);
            legend.color(color);
        }},
        useInteractiveGuideline: {get: function(){return useInteractiveGuideline;}, set: function(_){
            useInteractiveGuideline = _;
            if (_ === true) {
                chart.interactive(false);
                chart.useVoronoi(false);
            }
        }},
        rightAlignYAxis: {get: function(){return rightAlignYAxis;}, set: function(_){
            rightAlignYAxis = _;
            yAxis.orient( (_) ? 'right' : 'left');
        }},
        duration:    {get: function(){return duration;}, set: function(_){
            duration = _;
            lines.duration(duration);
            xAxis.duration(duration);
            yAxis.duration(duration);
            renderWatch.reset(duration);
        }}
    });

    nv.utils.inheritOptions(chart, lines);
    nv.utils.initOptions(chart);

    return chart;
};
