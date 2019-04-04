// Code adapted from Jason Davies' "Parallel Coordinates"
// http://bl.ocks.org/jasondavies/1341281
nv.models.parallelCoordinates = function() {
    "use strict";

    //============================================================
    // Public Variables with Default Settings
    //------------------------------------------------------------

    var margin = {top: 30, right: 0, bottom: 10, left: 0}
        , width = null
        , height = null
        , availableWidth = null
        , availableHeight = null
        , x = d3.scale.ordinal()
        , y = {}
        , undefinedValuesLabel = "undefined values"
        , dimensionData = []
        , enabledDimensions = []
        , dimensionNames = []
        , displayBrush = true
        , color = nv.utils.defaultColor()
        , filters = []
        , active = []
        , dragging = []
        , axisWithUndefinedValues = []
        , lineTension = 1
        , foreground
        , background
        , dimensions
        , line = d3.svg.line()
        , axis = d3.svg.axis()
        , dispatch = d3.dispatch('brushstart', 'brush', 'brushEnd', 'dimensionsOrder', "stateChange", 'elementClick', 'elementMouseover', 'elementMouseout', 'elementMousemove', 'renderEnd', 'activeChanged')
        ;

    //============================================================
    // Private Variables
    //------------------------------------------------------------

    var renderWatch = nv.utils.renderWatch(dispatch);

    function chart(selection) {
        renderWatch.reset();
        selection.each(function(data) {
            var container = d3.select(this);
            availableWidth = nv.utils.availableWidth(width, container, margin);
            availableHeight = nv.utils.availableHeight(height, container, margin);

            nv.utils.initSVG(container);

           //Convert old data to new format (name, values)
            if (data[0].values === undefined) {
                var newData = [];
                data.forEach(function (d) {
                        var val = {};
                        var key = Object.keys(d);
                        key.forEach(function (k) { if (k !== "name") val[k] = d[k] });
                        newData.push({ key: d.name, values: val });
                });
                data = newData;
            }

            var dataValues = data.map(function (d) {return d.values});
            if (active.length === 0) {
                active = data;
            }; //set all active before first brush call
            
            dimensionNames = dimensionData.sort(function (a, b) { return a.currentPosition - b.currentPosition; }).map(function (d) { return d.key });
            enabledDimensions = dimensionData.filter(function (d) { return !d.disabled; });
            
            // Setup Scales
            x.rangePoints([0, availableWidth], 1).domain(enabledDimensions.map(function (d) { return d.key; }));

            //Set as true if all values on an axis are missing.
            // Extract the list of dimensions and create a scale for each.
            var oldDomainMaxValue = {};
            var displayMissingValuesline = false;
            var currentTicks = [];
            
            dimensionNames.forEach(function(d) {
                var extent = d3.extent(dataValues, function (p) { return +p[d]; });
                var min = extent[0];
                var max = extent[1];
                var onlyUndefinedValues = false;
                //If there is no values to display on an axis, set the extent to 0
                if (isNaN(min) || isNaN(max)) {
                    onlyUndefinedValues = true;
                    min = 0;
                    max = 0;
                }
                //Scale axis if there is only one value
                if (min === max) {
                    min = min - 1;
                    max = max + 1;
                }
                var f = filters.filter(function (k) { return k.dimension == d; });
                if (f.length !== 0) {
                    //If there is only NaN values, keep the existing domain.
                    if (onlyUndefinedValues) {
                        min = y[d].domain()[0];
                        max = y[d].domain()[1];
                    }
                        //If the brush extent is > max (< min), keep the extent value.
                    else if (!f[0].hasOnlyNaN && displayBrush) {
                        min = min > f[0].extent[0] ? f[0].extent[0] : min;
                        max = max < f[0].extent[1] ? f[0].extent[1] : max;
                    }
                        //If there is NaN values brushed be sure the brush extent is on the domain.
                    else if (f[0].hasNaN) {
                        max = max < f[0].extent[1] ? f[0].extent[1] : max;
                        oldDomainMaxValue[d] = y[d].domain()[1];
                        displayMissingValuesline = true;
                    }
                }
                //Use 90% of (availableHeight - 12) for the axis range, 12 reprensenting the space necessary to display "undefined values" text.
                //The remaining 10% are used to display the missingValue line.
                y[d] = d3.scale.linear()
                    .domain([min, max])
                    .range([(availableHeight - 12) * 0.9, 0]);

                axisWithUndefinedValues = [];
                y[d].brush = d3.svg.brush().y(y[d]).on('brushstart', brushstart).on('brush', brush).on('brushend', brushend);
            });

            // Setup containers and skeleton of chart
            var wrap = container.selectAll('g.nv-wrap.nv-parallelCoordinates').data([data]);
            var wrapEnter = wrap.enter().append('g').attr('class', 'nvd3 nv-wrap nv-parallelCoordinates');
            var gEnter = wrapEnter.append('g');
            var g = wrap.select('g');

            gEnter.append('g').attr('class', 'nv-parallelCoordinates background');
            gEnter.append('g').attr('class', 'nv-parallelCoordinates foreground');
            gEnter.append('g').attr('class', 'nv-parallelCoordinates missingValuesline');

            wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

            line.interpolate('cardinal').tension(lineTension);
            axis.orient('left');
            var axisDrag = d3.behavior.drag()
                        .on('dragstart', dragStart)
                        .on('drag', dragMove)
                        .on('dragend', dragEnd);

            //Add missing value line at the bottom of the chart
            var missingValuesline, missingValueslineText;
            var step = x.range()[1] - x.range()[0];
            step = isNaN(step) ? x.range()[0] : step;
            if (!isNaN(step)) {
                var lineData = [0 + step / 2, availableHeight - 12, availableWidth - step / 2, availableHeight - 12];
                missingValuesline = wrap.select('.missingValuesline').selectAll('line').data([lineData]);
                missingValuesline.enter().append('line');
                missingValuesline.exit().remove();
                missingValuesline.attr("x1", function(d) { return d[0]; })
                        .attr("y1", function(d) { return d[1]; })
                        .attr("x2", function(d) { return d[2]; })
                        .attr("y2", function(d) { return d[3]; });
    
                //Add the text "undefined values" under the missing value line
                missingValueslineText = wrap.select('.missingValuesline').selectAll('text').data([undefinedValuesLabel]);
                missingValueslineText.append('text').data([undefinedValuesLabel]);
                missingValueslineText.enter().append('text');
                missingValueslineText.exit().remove();
                missingValueslineText.attr("y", availableHeight)
                        //To have the text right align with the missingValues line, substract 92 representing the text size.
                        .attr("x", availableWidth - 92 - step / 2)
                        .text(function(d) { return d; });
            }
            // Add grey background lines for context.
            background = wrap.select('.background').selectAll('path').data(data);
            background.enter().append('path');
            background.exit().remove();
            background.attr('d', path);

            // Add blue foreground lines for focus.
            foreground = wrap.select('.foreground').selectAll('path').data(data);
            foreground.enter().append('path')
            foreground.exit().remove();
            foreground.attr('d', path)
                .style("stroke-width", function (d, i) {
                if (isNaN(d.strokeWidth)) { d.strokeWidth = 1;} return d.strokeWidth;})
                .attr('stroke', function (d, i) { return d.color || color(d, i); });
            foreground.on("mouseover", function (d, i) {
                d3.select(this).classed('hover', true).style("stroke-width", d.strokeWidth + 2 + "px").style("stroke-opacity", 1);
                dispatch.elementMouseover({
                    label: d.name,
                    color: d.color || color(d, i),
                    values: d.values,
                    dimensions: enabledDimensions
                });

            });
            foreground.on("mouseout", function (d, i) {
                d3.select(this).classed('hover', false).style("stroke-width", d.strokeWidth + "px").style("stroke-opacity", 0.7);
                dispatch.elementMouseout({
                    label: d.name,
                    index: i
                });
            });
            foreground.on('mousemove', function (d, i) {
                dispatch.elementMousemove();
            });
            foreground.on('click', function (d) {
                dispatch.elementClick({
                    id: d.id
                });
            });
            // Add a group element for each dimension.
            dimensions = g.selectAll('.dimension').data(enabledDimensions);
            var dimensionsEnter = dimensions.enter().append('g').attr('class', 'nv-parallelCoordinates dimension');

            dimensions.attr('transform', function(d) { return 'translate(' + x(d.key) + ',0)'; });
            dimensionsEnter.append('g').attr('class', 'nv-axis');

            // Add an axis and title.
            dimensionsEnter.append('text')
                .attr('class', 'nv-label')
                .style("cursor", "move")
                .attr('dy', '-1em')
                .attr('text-anchor', 'middle')
                .on("mouseover", function(d, i) {
                    dispatch.elementMouseover({
                        label: d.tooltip || d.key,
                        color: d.color 
                    });
                })
                .on("mouseout", function(d, i) {
                    dispatch.elementMouseout({
                        label: d.tooltip
                    });
                })
                .on('mousemove', function (d, i) {
                    dispatch.elementMousemove();
                })
                .call(axisDrag);

            dimensionsEnter.append('g').attr('class', 'nv-brushBackground');
            dimensions.exit().remove();
            dimensions.select('.nv-label').text(function (d) { return d.key });

            // Add and store a brush for each axis.
            restoreBrush(displayBrush);

            var actives = dimensionNames.filter(function (p) { return !y[p].brush.empty(); }),
                    extents = actives.map(function (p) { return y[p].brush.extent(); });
            var formerActive = active.slice(0);

            //Restore active values
            active = [];
            foreground.style("display", function (d) {
                var isActive = actives.every(function (p, i) {
                    if ((isNaN(d.values[p]) || isNaN(parseFloat(d.values[p]))) && extents[i][0] == y[p].brush.y().domain()[0]) {
                        return true;
                    }
                    return (extents[i][0] <= d.values[p] && d.values[p] <= extents[i][1]) && !isNaN(parseFloat(d.values[p]));
                });
                if (isActive)
                    active.push(d);
                return !isActive ? "none" : null;

            });

            if (filters.length > 0 || !nv.utils.arrayEquals(active, formerActive)) {
               dispatch.activeChanged(active);
            }

            // Returns the path for a given data point.
            function path(d) {
                return line(enabledDimensions.map(function (p) {
                    //If value if missing, put the value on the missing value line
                    if (isNaN(d.values[p.key]) || isNaN(parseFloat(d.values[p.key])) || displayMissingValuesline) {
                        var domain = y[p.key].domain();
                        var range = y[p.key].range();
                        var min = domain[0] - (domain[1] - domain[0]) / 9;

                        //If it's not already the case, allow brush to select undefined values
                        if (axisWithUndefinedValues.indexOf(p.key) < 0) {

                            var newscale = d3.scale.linear().domain([min, domain[1]]).range([availableHeight - 12, range[1]]);
                            y[p.key].brush.y(newscale);
                            axisWithUndefinedValues.push(p.key);
                        }
                        if (isNaN(d.values[p.key]) || isNaN(parseFloat(d.values[p.key]))) {
                            return [x(p.key), y[p.key](min)];
                        }
                    }

                    //If parallelCoordinate contain missing values show the missing values line otherwise, hide it.
                    if (missingValuesline !== undefined) {
                        if (axisWithUndefinedValues.length > 0 || displayMissingValuesline) {
                            missingValuesline.style("display", "inline");
                            missingValueslineText.style("display", "inline");
                        } else {
                            missingValuesline.style("display", "none");
                            missingValueslineText.style("display", "none");
                        }
                    }
                    return [x(p.key), y[p.key](d.values[p.key])];
                }));
            }

            function restoreBrush(visible) {
                filters.forEach(function (f) {
                    //If filter brushed NaN values, keep the brush on the bottom of the axis.
                    var brushDomain = y[f.dimension].brush.y().domain();
                    if (f.hasOnlyNaN) {
                        f.extent[1] = (y[f.dimension].domain()[1] - brushDomain[0]) * (f.extent[1] - f.extent[0]) / (oldDomainMaxValue[f.dimension] - f.extent[0]) + brushDomain[0];
                    }
                    if (f.hasNaN) {
                        f.extent[0] = brushDomain[0];
                    }
                    if (visible)
                        y[f.dimension].brush.extent(f.extent);
                });
                
                dimensions.select('.nv-brushBackground')
                    .each(function (d) {
                        d3.select(this).call(y[d.key].brush);

                    })
                    .selectAll('rect')
                    .attr('x', -8)
                    .attr('width', 16);
                
                updateTicks();
            }
            
            // Handles a brush event, toggling the display of foreground lines.
            function brushstart() {
                //If brush aren't visible, show it before brushing again.
                if (displayBrush === false) {
                    displayBrush = true;
                    restoreBrush(true);
                }
            }
            
            // Handles a brush event, toggling the display of foreground lines.
            function brush() {
                actives = dimensionNames.filter(function (p) { return !y[p].brush.empty(); });
                extents = actives.map(function(p) { return y[p].brush.extent(); });

                filters = []; //erase current filters
                actives.forEach(function(d,i) {
                    filters[i] = {
                        dimension: d,
                        extent: extents[i],
                        hasNaN: false,
                        hasOnlyNaN: false
                    }
                });

                active = []; //erase current active list
                foreground.style('display', function(d) {
                    var isActive = actives.every(function(p, i) {
                        if ((isNaN(d.values[p]) || isNaN(parseFloat(d.values[p]))) && extents[i][0] == y[p].brush.y().domain()[0]) return true;
                        return (extents[i][0] <= d.values[p] && d.values[p] <= extents[i][1]) && !isNaN(parseFloat(d.values[p]));
                    });
                    if (isActive) active.push(d);
                    return isActive ? null : 'none';
                });
                
                updateTicks();
                
                dispatch.brush({
                    filters: filters,
                    active: active
                });
            }
            function brushend() {
                var hasActiveBrush = actives.length > 0 ? true : false;
                filters.forEach(function (f) {
                    if (f.extent[0] === y[f.dimension].brush.y().domain()[0] && axisWithUndefinedValues.indexOf(f.dimension) >= 0)
                        f.hasNaN = true;
                    if (f.extent[1] < y[f.dimension].domain()[0])
                        f.hasOnlyNaN = true;
                });
                dispatch.brushEnd(active, hasActiveBrush);
            }           
            function updateTicks() {
                dimensions.select('.nv-axis')
                    .each(function (d, i) {
                        var f = filters.filter(function (k) { return k.dimension == d.key; });
                        currentTicks[d.key] = y[d.key].domain();
                        
                        //If brush are available, display brush extent
                        if (f.length != 0 && displayBrush)
                        {
                            currentTicks[d.key] = [];
                            if (f[0].extent[1] > y[d.key].domain()[0]) 
                                currentTicks[d.key] = [f[0].extent[1]];
                            if (f[0].extent[0] >= y[d.key].domain()[0])
                                currentTicks[d.key].push(f[0].extent[0]);    
                        }
                            
                        d3.select(this).call(axis.scale(y[d.key]).tickFormat(d.format).tickValues(currentTicks[d.key]));
                });
            }
            function dragStart(d) {
                dragging[d.key] = this.parentNode.__origin__ = x(d.key);
                background.attr("visibility", "hidden");
            }
            function dragMove(d) {
                dragging[d.key] = Math.min(availableWidth, Math.max(0, this.parentNode.__origin__ += d3.event.x));
                foreground.attr("d", path);
                enabledDimensions.sort(function (a, b) { return dimensionPosition(a.key) - dimensionPosition(b.key); });
                enabledDimensions.forEach(function (d, i) { return d.currentPosition = i; });
                x.domain(enabledDimensions.map(function (d) { return d.key; }));
                dimensions.attr("transform", function(d) { return "translate(" + dimensionPosition(d.key) + ")"; });
            }
            function dragEnd(d, i) {
                delete this.parentNode.__origin__;
                delete dragging[d.key];
                d3.select(this.parentNode).attr("transform", "translate(" + x(d.key) + ")");
                foreground
                  .attr("d", path);
                background
                  .attr("d", path)
                  .attr("visibility", null);

                dispatch.dimensionsOrder(enabledDimensions);
            }
            function dimensionPosition(d) {
                var v = dragging[d];
                return v == null ? x(d) : v;
            }
        });
        return chart;
    }

    //============================================================
    // Expose Public Variables
    //------------------------------------------------------------

    chart.dispatch = dispatch;
    chart.options = nv.utils.optionsFunc.bind(chart);

    chart._options = Object.create({}, {
        // simple options, just get/set the necessary values
        width:         {get: function(){return width;},           set: function(_){width= _;}},
        height:        {get: function(){return height;},          set: function(_){height= _;}},
        dimensionData: { get: function () { return dimensionData; }, set: function (_) { dimensionData = _; } },
        displayBrush: { get: function () { return displayBrush; }, set: function (_) { displayBrush = _; } },
        filters: { get: function () { return filters; }, set: function (_) { filters = _; } },
        active: { get: function () { return active; }, set: function (_) { active = _; } },
        lineTension:   {get: function(){return lineTension;},     set: function(_){lineTension = _;}},
        undefinedValuesLabel : {get: function(){return undefinedValuesLabel;}, set: function(_){undefinedValuesLabel=_;}},
        
        // deprecated options
        dimensions: {get: function () { return dimensionData.map(function (d){return d.key}); }, set: function (_) {
            // deprecated after 1.8.1
            nv.deprecated('dimensions', 'use dimensionData instead');
            if (dimensionData.length === 0) {
                _.forEach(function (k) { dimensionData.push({ key: k }) })
            } else {
                _.forEach(function (k, i) { dimensionData[i].key= k })
            }
        }},
        dimensionNames: {get: function () { return dimensionData.map(function (d){return d.key}); }, set: function (_) {
            // deprecated after 1.8.1
            nv.deprecated('dimensionNames', 'use dimensionData instead');
            dimensionNames = [];
            if (dimensionData.length === 0) {
                _.forEach(function (k) { dimensionData.push({ key: k }) })
            } else {
                _.forEach(function (k, i) { dimensionData[i].key = k })
            }
 
        }},
        dimensionFormats: {get: function () { return dimensionData.map(function (d) { return d.format }); }, set: function (_) {
            // deprecated after 1.8.1
            nv.deprecated('dimensionFormats', 'use dimensionData instead');
            if (dimensionData.length === 0) {
                _.forEach(function (f) { dimensionData.push({ format: f }) })
            } else {
                _.forEach(function (f, i) { dimensionData[i].format = f })
            }

        }},
        // options that require extra logic in the setter
        margin: {get: function(){return margin;}, set: function(_){
            margin.top    =  _.top    !== undefined ? _.top    : margin.top;
            margin.right  =  _.right  !== undefined ? _.right  : margin.right;
            margin.bottom =  _.bottom !== undefined ? _.bottom : margin.bottom;
            margin.left   =  _.left   !== undefined ? _.left   : margin.left;
        }},
        color:  {get: function(){return color;}, set: function(_){
            color = nv.utils.getColor(_);
        }}
    });
    nv.utils.initOptions(chart);
    return chart;
};
