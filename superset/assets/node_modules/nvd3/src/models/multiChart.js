nv.models.multiChart = function() {
    "use strict";

    //============================================================
    // Public Variables with Default Settings
    //------------------------------------------------------------

    var margin = {top: 30, right: 20, bottom: 50, left: 60},
        marginTop = null,
        color = nv.utils.defaultColor(),
        width = null,
        height = null,
        showLegend = true,
        noData = null,
        yDomain1,
        yDomain2,
        getX = function(d) { return d.x },
        getY = function(d) { return d.y},
        interpolate = 'linear',
        useVoronoi = true,
        interactiveLayer = nv.interactiveGuideline(),
        useInteractiveGuideline = false,
        legendRightAxisHint = ' (right axis)',
        duration = 250
        ;

    //============================================================
    // Private Variables
    //------------------------------------------------------------

    var x = d3.scale.linear(),
        yScale1 = d3.scale.linear(),
        yScale2 = d3.scale.linear(),

        lines1 = nv.models.line().yScale(yScale1).duration(duration),
        lines2 = nv.models.line().yScale(yScale2).duration(duration),

        scatters1 = nv.models.scatter().yScale(yScale1).duration(duration),
        scatters2 = nv.models.scatter().yScale(yScale2).duration(duration),

        bars1 = nv.models.multiBar().stacked(false).yScale(yScale1).duration(duration),
        bars2 = nv.models.multiBar().stacked(false).yScale(yScale2).duration(duration),

        stack1 = nv.models.stackedArea().yScale(yScale1).duration(duration),
        stack2 = nv.models.stackedArea().yScale(yScale2).duration(duration),

        xAxis = nv.models.axis().scale(x).orient('bottom').tickPadding(5).duration(duration),
        yAxis1 = nv.models.axis().scale(yScale1).orient('left').duration(duration),
        yAxis2 = nv.models.axis().scale(yScale2).orient('right').duration(duration),

        legend = nv.models.legend().height(30),
        tooltip = nv.models.tooltip(),
        dispatch = d3.dispatch();

    var charts = [lines1, lines2, scatters1, scatters2, bars1, bars2, stack1, stack2];

    function chart(selection) {
        selection.each(function(data) {
            var container = d3.select(this),
                that = this;
            nv.utils.initSVG(container);

            chart.update = function() { container.transition().call(chart); };
            chart.container = this;

            var availableWidth = nv.utils.availableWidth(width, container, margin),
                availableHeight = nv.utils.availableHeight(height, container, margin);

            var dataLines1 = data.filter(function(d) {return d.type == 'line' && d.yAxis == 1});
            var dataLines2 = data.filter(function(d) {return d.type == 'line' && d.yAxis == 2});
            var dataScatters1 = data.filter(function(d) {return d.type == 'scatter' && d.yAxis == 1});
            var dataScatters2 = data.filter(function(d) {return d.type == 'scatter' && d.yAxis == 2});
            var dataBars1 =  data.filter(function(d) {return d.type == 'bar'  && d.yAxis == 1});
            var dataBars2 =  data.filter(function(d) {return d.type == 'bar'  && d.yAxis == 2});
            var dataStack1 = data.filter(function(d) {return d.type == 'area' && d.yAxis == 1});
            var dataStack2 = data.filter(function(d) {return d.type == 'area' && d.yAxis == 2});

            // Display noData message if there's nothing to show.
            if (!data || !data.length || !data.filter(function(d) { return d.values.length }).length) {
                nv.utils.noData(chart, container);
                return chart;
            } else {
                container.selectAll('.nv-noData').remove();
            }

            var series1 = data.filter(function(d) {return !d.disabled && d.yAxis == 1})
                .map(function(d) {
                    return d.values.map(function(d,i) {
                        return { x: getX(d), y: getY(d) }
                    })
                });

            var series2 = data.filter(function(d) {return !d.disabled && d.yAxis == 2})
                .map(function(d) {
                    return d.values.map(function(d,i) {
                        return { x: getX(d), y: getY(d) }
                    })
                });

            x   .domain(d3.extent(d3.merge(series1.concat(series2)), function(d) { return d.x }))
                .range([0, availableWidth]);

            var wrap = container.selectAll('g.wrap.multiChart').data([data]);
            var gEnter = wrap.enter().append('g').attr('class', 'wrap nvd3 multiChart').append('g');

            gEnter.append('g').attr('class', 'nv-x nv-axis');
            gEnter.append('g').attr('class', 'nv-y1 nv-axis');
            gEnter.append('g').attr('class', 'nv-y2 nv-axis');
            gEnter.append('g').attr('class', 'stack1Wrap');
            gEnter.append('g').attr('class', 'stack2Wrap');
            gEnter.append('g').attr('class', 'bars1Wrap');
            gEnter.append('g').attr('class', 'bars2Wrap');
            gEnter.append('g').attr('class', 'scatters1Wrap');
            gEnter.append('g').attr('class', 'scatters2Wrap');
            gEnter.append('g').attr('class', 'lines1Wrap');
            gEnter.append('g').attr('class', 'lines2Wrap');
            gEnter.append('g').attr('class', 'legendWrap');
            gEnter.append('g').attr('class', 'nv-interactive');

            var g = wrap.select('g');

            var color_array = data.map(function(d,i) {
                return data[i].color || color(d, i);
            });

            // Legend
            if (!showLegend) {
                g.select('.legendWrap').selectAll('*').remove();
            } else {
                var legendWidth = legend.align() ? availableWidth / 2 : availableWidth;
                var legendXPosition = legend.align() ? legendWidth : 0;

                legend.width(legendWidth);
                legend.color(color_array);

                g.select('.legendWrap')
                    .datum(data.map(function(series) {
                        series.originalKey = series.originalKey === undefined ? series.key : series.originalKey;
                        series.key = series.originalKey + (series.yAxis == 1 ? '' : legendRightAxisHint);
                        return series;
                    }))
                    .call(legend);

                if (!marginTop && legend.height() !== margin.top) {
                    margin.top = legend.height();
                    availableHeight = nv.utils.availableHeight(height, container, margin);
                }

                g.select('.legendWrap')
                    .attr('transform', 'translate(' + legendXPosition + ',' + (-margin.top) +')');
            }

            lines1
                .width(availableWidth)
                .height(availableHeight)
                .interpolate(interpolate)
                .color(color_array.filter(function(d,i) { return !data[i].disabled && data[i].yAxis == 1 && data[i].type == 'line'}));
            lines2
                .width(availableWidth)
                .height(availableHeight)
                .interpolate(interpolate)
                .color(color_array.filter(function(d,i) { return !data[i].disabled && data[i].yAxis == 2 && data[i].type == 'line'}));
            scatters1
                .width(availableWidth)
                .height(availableHeight)
                .color(color_array.filter(function(d,i) { return !data[i].disabled && data[i].yAxis == 1 && data[i].type == 'scatter'}));
            scatters2
                .width(availableWidth)
                .height(availableHeight)
                .color(color_array.filter(function(d,i) { return !data[i].disabled && data[i].yAxis == 2 && data[i].type == 'scatter'}));
            bars1
                .width(availableWidth)
                .height(availableHeight)
                .color(color_array.filter(function(d,i) { return !data[i].disabled && data[i].yAxis == 1 && data[i].type == 'bar'}));
            bars2
                .width(availableWidth)
                .height(availableHeight)
                .color(color_array.filter(function(d,i) { return !data[i].disabled && data[i].yAxis == 2 && data[i].type == 'bar'}));
            stack1
                .width(availableWidth)
                .height(availableHeight)
                .interpolate(interpolate)
                .color(color_array.filter(function(d,i) { return !data[i].disabled && data[i].yAxis == 1 && data[i].type == 'area'}));
            stack2
                .width(availableWidth)
                .height(availableHeight)
                .interpolate(interpolate)
                .color(color_array.filter(function(d,i) { return !data[i].disabled && data[i].yAxis == 2 && data[i].type == 'area'}));

            g.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

            var lines1Wrap = g.select('.lines1Wrap')
                .datum(dataLines1.filter(function(d){return !d.disabled}));
            var scatters1Wrap = g.select('.scatters1Wrap')
                .datum(dataScatters1.filter(function(d){return !d.disabled}));
            var bars1Wrap = g.select('.bars1Wrap')
                .datum(dataBars1.filter(function(d){return !d.disabled}));
            var stack1Wrap = g.select('.stack1Wrap')
                .datum(dataStack1.filter(function(d){return !d.disabled}));
            var lines2Wrap = g.select('.lines2Wrap')
                .datum(dataLines2.filter(function(d){return !d.disabled}));
            var scatters2Wrap = g.select('.scatters2Wrap')
                .datum(dataScatters2.filter(function(d){return !d.disabled}));
            var bars2Wrap = g.select('.bars2Wrap')
                .datum(dataBars2.filter(function(d){return !d.disabled}));
            var stack2Wrap = g.select('.stack2Wrap')
                .datum(dataStack2.filter(function(d){return !d.disabled}));

            var extraValue1BarStacked = [];
            if (bars1.stacked() && dataBars1.length) {
                var extraValue1BarStacked = dataBars1.filter(function(d){return !d.disabled}).map(function(a){return a.values});
                
                if (extraValue1BarStacked.length > 0)
                    extraValue1BarStacked = extraValue1BarStacked.reduce(function(a,b){
                        return a.map(function(aVal,i){return {x: aVal.x, y: aVal.y + b[i].y}})
                    });
            }
            if (dataBars1.length) {
                extraValue1BarStacked.push({x:0, y:0});
            }
            
            var extraValue2BarStacked = [];
            if (bars2.stacked() && dataBars2.length) {
                var extraValue2BarStacked = dataBars2.filter(function(d){return !d.disabled}).map(function(a){return a.values});
                
                if (extraValue2BarStacked.length > 0)
                    extraValue2BarStacked = extraValue2BarStacked.reduce(function(a,b){
                        return a.map(function(aVal,i){return {x: aVal.x, y: aVal.y + b[i].y}})
                    });
            }
            if (dataBars2.length) {
                extraValue2BarStacked.push({x:0, y:0});
            }
            
            yScale1 .domain(yDomain1 || d3.extent(d3.merge(series1).concat(extraValue1BarStacked), function(d) { return d.y } ))
                .range([0, availableHeight]);

            yScale2 .domain(yDomain2 || d3.extent(d3.merge(series2).concat(extraValue2BarStacked), function(d) { return d.y } ))
                .range([0, availableHeight]);

            lines1.yDomain(yScale1.domain());
            scatters1.yDomain(yScale1.domain());
            bars1.yDomain(yScale1.domain());
            stack1.yDomain(yScale1.domain());

            lines2.yDomain(yScale2.domain());
            scatters2.yDomain(yScale2.domain());
            bars2.yDomain(yScale2.domain());
            stack2.yDomain(yScale2.domain());

            if(dataStack1.length){d3.transition(stack1Wrap).call(stack1);}
            if(dataStack2.length){d3.transition(stack2Wrap).call(stack2);}

            if(dataBars1.length){d3.transition(bars1Wrap).call(bars1);}
            if(dataBars2.length){d3.transition(bars2Wrap).call(bars2);}

            if(dataLines1.length){d3.transition(lines1Wrap).call(lines1);}
            if(dataLines2.length){d3.transition(lines2Wrap).call(lines2);}

            if(dataScatters1.length){d3.transition(scatters1Wrap).call(scatters1);}
            if(dataScatters2.length){d3.transition(scatters2Wrap).call(scatters2);}

            xAxis
                ._ticks( nv.utils.calcTicksX(availableWidth/100, data) )
                .tickSize(-availableHeight, 0);

            g.select('.nv-x.nv-axis')
                .attr('transform', 'translate(0,' + availableHeight + ')');
            d3.transition(g.select('.nv-x.nv-axis'))
                .call(xAxis);

            yAxis1
                ._ticks( nv.utils.calcTicksY(availableHeight/36, data) )
                .tickSize( -availableWidth, 0);


            d3.transition(g.select('.nv-y1.nv-axis'))
                .call(yAxis1);

            yAxis2
                ._ticks( nv.utils.calcTicksY(availableHeight/36, data) )
                .tickSize( -availableWidth, 0);

            d3.transition(g.select('.nv-y2.nv-axis'))
                .call(yAxis2);

            g.select('.nv-y1.nv-axis')
                .classed('nv-disabled', series1.length ? false : true)
                .attr('transform', 'translate(' + x.range()[0] + ',0)');

            g.select('.nv-y2.nv-axis')
                .classed('nv-disabled', series2.length ? false : true)
                .attr('transform', 'translate(' + x.range()[1] + ',0)');

            legend.dispatch.on('stateChange', function(newState) {
                chart.update();
            });

            if(useInteractiveGuideline){
                interactiveLayer
                    .width(availableWidth)
                    .height(availableHeight)
                    .margin({left:margin.left, top:margin.top})
                    .svgContainer(container)
                    .xScale(x);
                wrap.select(".nv-interactive").call(interactiveLayer);
            }

            //============================================================
            // Event Handling/Dispatching
            //------------------------------------------------------------

            function mouseover_line(evt) {
                var yaxis = evt.series.yAxis === 2 ? yAxis2 : yAxis1;
                evt.value = evt.point.x;
                evt.series = {
                    value: evt.point.y,
                    color: evt.point.color,
                    key: evt.series.key
                };
                tooltip
                    .duration(0)
                    .headerFormatter(function(d, i) {
                    	return xAxis.tickFormat()(d, i);
                    })
                    .valueFormatter(function(d, i) {
                        return yaxis.tickFormat()(d, i);
                    })
                    .data(evt)
                    .hidden(false);
            }

            function mouseover_scatter(evt) {
                var yaxis = evt.series.yAxis === 2 ? yAxis2 : yAxis1;
                evt.value = evt.point.x;
                evt.series = {
                    value: evt.point.y,
                    color: evt.point.color,
                    key: evt.series.key
                };
                tooltip
                    .duration(100)
                    .headerFormatter(function(d, i) {
                    	return xAxis.tickFormat()(d, i);
                    })
                    .valueFormatter(function(d, i) {
                        return yaxis.tickFormat()(d, i);
                    })
                    .data(evt)
                    .hidden(false);
            }

            function mouseover_stack(evt) {
                var yaxis = evt.series.yAxis === 2 ? yAxis2 : yAxis1;
                evt.point['x'] = stack1.x()(evt.point);
                evt.point['y'] = stack1.y()(evt.point);
                tooltip
                    .duration(0)
                    .headerFormatter(function(d, i) {
                    	return xAxis.tickFormat()(d, i);
                    })
                    .valueFormatter(function(d, i) {
                        return yaxis.tickFormat()(d, i);
                    })
                    .data(evt)
                    .hidden(false);
            }

            function mouseover_bar(evt) {
                var yaxis = evt.series.yAxis === 2 ? yAxis2 : yAxis1;

                evt.value = bars1.x()(evt.data);
                evt['series'] = {
                    value: bars1.y()(evt.data),
                    color: evt.color,
                    key: evt.data.key
                };
                tooltip
                    .duration(0)
                    .headerFormatter(function(d, i) {
                    	return xAxis.tickFormat()(d, i);
                    })
                    .valueFormatter(function(d, i) {
                        return yaxis.tickFormat()(d, i);
                    })
                    .data(evt)
                    .hidden(false);
            }



            function clearHighlights() {
              for(var i=0, il=charts.length; i < il; i++){
                var chart = charts[i];
                try {
                  chart.clearHighlights();
                } catch(e){}
              }
            }

            function highlightPoint(serieIndex, pointIndex, b){
              for(var i=0, il=charts.length; i < il; i++){
                var chart = charts[i];
                try {
                  chart.highlightPoint(serieIndex, pointIndex, b);
                } catch(e){}
              }
            }

            if(useInteractiveGuideline){
                interactiveLayer.dispatch.on('elementMousemove', function(e) {
                    clearHighlights();
                    var singlePoint, pointIndex, pointXLocation, allData = [];
                    data
                    .filter(function(series, i) {
                        series.seriesIndex = i;
                        return !series.disabled;
                    })
                    .forEach(function(series,i) {
                        var extent = x.domain();
                        var currentValues = series.values.filter(function(d,i) {
                            return chart.x()(d,i) >= extent[0] && chart.x()(d,i) <= extent[1];
                        });

                        pointIndex = nv.interactiveBisect(currentValues, e.pointXValue, chart.x());
                        var point = currentValues[pointIndex];
                        var pointYValue = chart.y()(point, pointIndex);
                        if (pointYValue !== null) {
                            highlightPoint(i, pointIndex, true);
                        }
                        if (point === undefined) return;
                        if (singlePoint === undefined) singlePoint = point;
                        if (pointXLocation === undefined) pointXLocation = x(chart.x()(point,pointIndex));
                        allData.push({
                            key: series.key,
                            value: pointYValue,
                            color: color(series,series.seriesIndex),
                            data: point,
                            yAxis: series.yAxis == 2 ? yAxis2 : yAxis1
                        });
                    });

                    var defaultValueFormatter = function(d,i) {
                        var yAxis = allData[i].yAxis;
                        return d == null ? "N/A" : yAxis.tickFormat()(d);
                    };

                    interactiveLayer.tooltip
                        .headerFormatter(function(d, i) {
                            return xAxis.tickFormat()(d, i);
                        })
                        .valueFormatter(interactiveLayer.tooltip.valueFormatter() || defaultValueFormatter)
                        .data({
                            value: chart.x()( singlePoint,pointIndex ),
                            index: pointIndex,
                            series: allData
                        })();

                    interactiveLayer.renderGuideLine(pointXLocation);
                });

                interactiveLayer.dispatch.on("elementMouseout",function(e) {
                    clearHighlights();
                });
            } else {
                lines1.dispatch.on('elementMouseover.tooltip', mouseover_line);
                lines2.dispatch.on('elementMouseover.tooltip', mouseover_line);
                lines1.dispatch.on('elementMouseout.tooltip', function(evt) {
                    tooltip.hidden(true)
                });
                lines2.dispatch.on('elementMouseout.tooltip', function(evt) {
                    tooltip.hidden(true)
                });

                scatters1.dispatch.on('elementMouseover.tooltip', mouseover_scatter);
                scatters2.dispatch.on('elementMouseover.tooltip', mouseover_scatter);
                scatters1.dispatch.on('elementMouseout.tooltip', function(evt) {
                    tooltip.hidden(true)
                });
                scatters2.dispatch.on('elementMouseout.tooltip', function(evt) {
                    tooltip.hidden(true)
                });

                stack1.dispatch.on('elementMouseover.tooltip', mouseover_stack);
                stack2.dispatch.on('elementMouseover.tooltip', mouseover_stack);
                stack1.dispatch.on('elementMouseout.tooltip', function(evt) {
                    tooltip.hidden(true)
                });
                stack2.dispatch.on('elementMouseout.tooltip', function(evt) {
                    tooltip.hidden(true)
                });

                bars1.dispatch.on('elementMouseover.tooltip', mouseover_bar);
                bars2.dispatch.on('elementMouseover.tooltip', mouseover_bar);

                bars1.dispatch.on('elementMouseout.tooltip', function(evt) {
                    tooltip.hidden(true);
                });
                bars2.dispatch.on('elementMouseout.tooltip', function(evt) {
                    tooltip.hidden(true);
                });
                bars1.dispatch.on('elementMousemove.tooltip', function(evt) {
                    tooltip();
                });
                bars2.dispatch.on('elementMousemove.tooltip', function(evt) {
                    tooltip();
                });
            }
        });

        return chart;
    }

    //============================================================
    // Global getters and setters
    //------------------------------------------------------------

    chart.dispatch = dispatch;
    chart.legend = legend;
    chart.lines1 = lines1;
    chart.lines2 = lines2;
    chart.scatters1 = scatters1;
    chart.scatters2 = scatters2;
    chart.bars1 = bars1;
    chart.bars2 = bars2;
    chart.stack1 = stack1;
    chart.stack2 = stack2;
    chart.xAxis = xAxis;
    chart.yAxis1 = yAxis1;
    chart.yAxis2 = yAxis2;
    chart.tooltip = tooltip;
    chart.interactiveLayer = interactiveLayer;

    chart.options = nv.utils.optionsFunc.bind(chart);

    chart._options = Object.create({}, {
        // simple options, just get/set the necessary values
        width:      {get: function(){return width;}, set: function(_){width=_;}},
        height:     {get: function(){return height;}, set: function(_){height=_;}},
        showLegend: {get: function(){return showLegend;}, set: function(_){showLegend=_;}},
        yDomain1:      {get: function(){return yDomain1;}, set: function(_){yDomain1=_;}},
        yDomain2:    {get: function(){return yDomain2;}, set: function(_){yDomain2=_;}},
        noData:    {get: function(){return noData;}, set: function(_){noData=_;}},
        interpolate:    {get: function(){return interpolate;}, set: function(_){interpolate=_;}},
        legendRightAxisHint:    {get: function(){return legendRightAxisHint;}, set: function(_){legendRightAxisHint=_;}},

        // options that require extra logic in the setter
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
        }},
        x: {get: function(){return getX;}, set: function(_){
            getX = _;
            lines1.x(_);
            lines2.x(_);
            scatters1.x(_);
            scatters2.x(_);
            bars1.x(_);
            bars2.x(_);
            stack1.x(_);
            stack2.x(_);
        }},
        y: {get: function(){return getY;}, set: function(_){
            getY = _;
            lines1.y(_);
            lines2.y(_);
            scatters1.y(_);
            scatters2.y(_);
            stack1.y(_);
            stack2.y(_);
            bars1.y(_);
            bars2.y(_);
        }},
        useVoronoi: {get: function(){return useVoronoi;}, set: function(_){
            useVoronoi=_;
            lines1.useVoronoi(_);
            lines2.useVoronoi(_);
            stack1.useVoronoi(_);
            stack2.useVoronoi(_);
        }},

        useInteractiveGuideline: {get: function(){return useInteractiveGuideline;}, set: function(_){
            useInteractiveGuideline = _;
            if (useInteractiveGuideline) {
                lines1.interactive(false);
                lines1.useVoronoi(false);
                lines2.interactive(false);
                lines2.useVoronoi(false);
                stack1.interactive(false);
                stack1.useVoronoi(false);
                stack2.interactive(false);
                stack2.useVoronoi(false);
                scatters1.interactive(false);
                scatters2.interactive(false);
            }
        }},

        duration: {get: function(){return duration;}, set: function(_) {
            duration = _;
            [lines1, lines2, stack1, stack2, scatters1, scatters2, xAxis, yAxis1, yAxis2].forEach(function(model){
              model.duration(duration);
            });
        }}
    });

    nv.utils.initOptions(chart);

    return chart;
};
