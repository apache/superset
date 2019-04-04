nv.models.legend = function() {
    "use strict";

    //============================================================
    // Public Variables with Default Settings
    //------------------------------------------------------------

    var margin = {top: 5, right: 0, bottom: 5, left: 0}
        , width = 400
        , height = 20
        , getKey = function(d) { return d.key }
        , keyFormatter = function (d) { return d }
        , color = nv.utils.getColor()
        , maxKeyLength = 20 //default value for key lengths
        , align = true
        , padding = 32 //define how much space between legend items. - recommend 32 for furious version
        , rightAlign = true
        , updateState = true   //If true, legend will update data.disabled and trigger a 'stateChange' dispatch.
        , enableDoubleClick = true   //If true, legend will enable double click handling
        , radioButtonMode = false   //If true, clicking legend items will cause it to behave like a radio button. (only one can be selected at a time)
        , expanded = false
        , dispatch = d3.dispatch('legendClick', 'legendDblclick', 'legendMouseover', 'legendMouseout', 'stateChange')
        , vers = 'classic' //Options are "classic" and "furious"
        ;

    function chart(selection) {
        selection.each(function(data) {
            var availableWidth = width - margin.left - margin.right,
                container = d3.select(this);
            nv.utils.initSVG(container);

            // Setup containers and skeleton of chart
            var wrap = container.selectAll('g.nv-legend').data([data]);
            var gEnter = wrap.enter().append('g').attr('class', 'nvd3 nv-legend').append('g');
            var g = wrap.select('g');

            if (rightAlign)
                wrap.attr('transform', 'translate(' + (- margin.right) + ',' + margin.top + ')');
            else
                wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

            var series = g.selectAll('.nv-series')
                .data(function(d) {
                    if(vers != 'furious') return d;

                    return d.filter(function(n) {
                        return expanded ? true : !n.disengaged;
                    });
                });

            var seriesEnter = series.enter().append('g').attr('class', 'nv-series');
            var seriesShape;

            var versPadding;
            switch(vers) {
                case 'furious' :
                    versPadding = 23;
                    break;
                case 'classic' :
                    versPadding = 20;
            }

            if(vers == 'classic') {
                seriesEnter.append('circle')
                    .style('stroke-width', 2)
                    .attr('class','nv-legend-symbol')
                    .attr('r', 5);

                seriesShape = series.select('.nv-legend-symbol');
            } else if (vers == 'furious') {
                seriesEnter.append('rect')
                    .style('stroke-width', 2)
                    .attr('class','nv-legend-symbol')
                    .attr('rx', 3)
                    .attr('ry', 3);
                seriesShape = series.select('.nv-legend-symbol');

                seriesEnter.append('g')
                    .attr('class', 'nv-check-box')
                    .property('innerHTML','<path d="M0.5,5 L22.5,5 L22.5,26.5 L0.5,26.5 L0.5,5 Z" class="nv-box"></path><path d="M5.5,12.8618467 L11.9185089,19.2803556 L31,0.198864511" class="nv-check"></path>')
                    .attr('transform', 'translate(-10,-8)scale(0.5)');

                var seriesCheckbox = series.select('.nv-check-box');

                seriesCheckbox.each(function(d,i) {
                    d3.select(this).selectAll('path')
                        .attr('stroke', setTextColor(d,i));
                });
            }

            seriesEnter.append('text')
                .attr('text-anchor', 'start')
                .attr('class','nv-legend-text')
                .attr('dy', '.32em')
                .attr('dx', '8');

            var seriesText = series.select('text.nv-legend-text');

            series
                .on('mouseover', function(d,i) {
                    dispatch.legendMouseover(d,i);  //TODO: Make consistent with other event objects
                })
                .on('mouseout', function(d,i) {
                    dispatch.legendMouseout(d,i);
                })
                .on('click', function(d,i) {
                    dispatch.legendClick(d,i);
                    // make sure we re-get data in case it was modified
                    var data = series.data();
                    if (updateState) {
                        if(vers =='classic') {
                            if (radioButtonMode) {
                                //Radio button mode: set every series to disabled,
                                //  and enable the clicked series.
                                data.forEach(function(series) { series.disabled = true});
                                d.disabled = false;
                            }
                            else {
                                d.disabled = !d.disabled;
                                if (data.every(function(series) { return series.disabled})) {
                                    //the default behavior of NVD3 legends is, if every single series
                                    // is disabled, turn all series' back on.
                                    data.forEach(function(series) { series.disabled = false});
                                }
                            }
                        } else if(vers == 'furious') {
                            if(expanded) {
                                d.disengaged = !d.disengaged;
                                d.userDisabled = d.userDisabled == undefined ? !!d.disabled : d.userDisabled;
                                d.disabled = d.disengaged || d.userDisabled;
                            } else if (!expanded) {
                                d.disabled = !d.disabled;
                                d.userDisabled = d.disabled;
                                var engaged = data.filter(function(d) { return !d.disengaged; });
                                if (engaged.every(function(series) { return series.userDisabled })) {
                                    //the default behavior of NVD3 legends is, if every single series
                                    // is disabled, turn all series' back on.
                                    data.forEach(function(series) {
                                        series.disabled = series.userDisabled = false;
                                    });
                                }
                            }
                        }
                        dispatch.stateChange({
                            disabled: data.map(function(d) { return !!d.disabled }),
                            disengaged: data.map(function(d) { return !!d.disengaged })
                        });

                    }
                })
                .on('dblclick', function(d,i) {
                    if (enableDoubleClick) {
                        if (vers == 'furious' && expanded) return;
                        dispatch.legendDblclick(d, i);
                        if (updateState) {
                            // make sure we re-get data in case it was modified
                            var data = series.data();
                            //the default behavior of NVD3 legends, when double clicking one,
                            // is to set all other series' to false, and make the double clicked series enabled.
                            data.forEach(function (series) {
                                series.disabled = true;
                                if (vers == 'furious') series.userDisabled = series.disabled;
                            });
                            d.disabled = false;
                            if (vers == 'furious') d.userDisabled = d.disabled;
                            dispatch.stateChange({
                                disabled: data.map(function (d) {
                                    return !!d.disabled
                                })
                            });
                        }
                    }
                });

            series.classed('nv-disabled', function(d) { return d.userDisabled });
            series.exit().remove();

            seriesText
                .attr('fill', setTextColor)
                .text(function (d) { return keyFormatter(getKey(d)) });

            //TODO: implement fixed-width and max-width options (max-width is especially useful with the align option)
            // NEW ALIGNING CODE, TODO: clean up
            var legendWidth = 0;
            if (align) {

                var seriesWidths = [];
                series.each(function(d,i) {
                    var legendText;
                    if (keyFormatter(getKey(d)) && keyFormatter(getKey(d)).length > maxKeyLength) {
                        var trimmedKey = keyFormatter(getKey(d)).substring(0, maxKeyLength);
                        legendText = d3.select(this).select('text').text(trimmedKey + "...");
                        d3.select(this).append("svg:title").text(keyFormatter(getKey(d)));
                    } else {
                        legendText = d3.select(this).select('text');
                    }
                    var nodeTextLength;
                    try {
                        nodeTextLength = legendText.node().getComputedTextLength();
                        // If the legendText is display:none'd (nodeTextLength == 0), simulate an error so we approximate, instead
                        if(nodeTextLength <= 0) throw Error();
                    }
                    catch(e) {
                        nodeTextLength = nv.utils.calcApproxTextWidth(legendText);
                    }

                    seriesWidths.push(nodeTextLength + padding);
                });

                var seriesPerRow = 0;
                var columnWidths = [];
                legendWidth = 0;

                while ( legendWidth < availableWidth && seriesPerRow < seriesWidths.length) {
                    columnWidths[seriesPerRow] = seriesWidths[seriesPerRow];
                    legendWidth += seriesWidths[seriesPerRow++];
                }
                if (seriesPerRow === 0) seriesPerRow = 1; //minimum of one series per row

                while ( legendWidth > availableWidth && seriesPerRow > 1 ) {
                    columnWidths = [];
                    seriesPerRow--;

                    for (var k = 0; k < seriesWidths.length; k++) {
                        if (seriesWidths[k] > (columnWidths[k % seriesPerRow] || 0) )
                            columnWidths[k % seriesPerRow] = seriesWidths[k];
                    }

                    legendWidth = columnWidths.reduce(function(prev, cur, index, array) {
                        return prev + cur;
                    });
                }

                var xPositions = [];
                for (var i = 0, curX = 0; i < seriesPerRow; i++) {
                    xPositions[i] = curX;
                    curX += columnWidths[i];
                }

                series
                    .attr('transform', function(d, i) {
                        return 'translate(' + xPositions[i % seriesPerRow] + ',' + (5 + Math.floor(i / seriesPerRow) * versPadding) + ')';
                    });

                //position legend as far right as possible within the total width
                if (rightAlign) {
                    g.attr('transform', 'translate(' + (width - margin.right - legendWidth) + ',' + margin.top + ')');
                }
                else {
                    g.attr('transform', 'translate(0' + ',' + margin.top + ')');
                }

                height = margin.top + margin.bottom + (Math.ceil(seriesWidths.length / seriesPerRow) * versPadding);

            } else {

                var ypos = 5,
                    newxpos = 5,
                    maxwidth = 0,
                    xpos;
                series
                    .attr('transform', function(d, i) {
                        var length = d3.select(this).select('text').node().getComputedTextLength() + padding;
                        xpos = newxpos;

                        if (width < margin.left + margin.right + xpos + length) {
                            newxpos = xpos = 5;
                            ypos += versPadding;
                        }

                        newxpos += length;
                        if (newxpos > maxwidth) maxwidth = newxpos;

                        if(legendWidth < xpos + maxwidth) {
                            legendWidth = xpos + maxwidth;
                        }
                        return 'translate(' + xpos + ',' + ypos + ')';
                    });

                //position legend as far right as possible within the total width
                g.attr('transform', 'translate(' + (width - margin.right - maxwidth) + ',' + margin.top + ')');

                height = margin.top + margin.bottom + ypos + 15;
            }

            if(vers == 'furious') {
                // Size rectangles after text is placed
                seriesShape
                    .attr('width', function(d,i) {
                        return seriesText[0][i].getComputedTextLength() + 27;
                    })
                    .attr('height', 18)
                    .attr('y', -9)
                    .attr('x', -15);

                // The background for the expanded legend (UI)
                gEnter.insert('rect',':first-child')
                    .attr('class', 'nv-legend-bg')
                    .attr('fill', '#eee')
                    // .attr('stroke', '#444')
                    .attr('opacity',0);

                var seriesBG = g.select('.nv-legend-bg');

                seriesBG
                .transition().duration(300)
                    .attr('x', -versPadding )
                    .attr('width', legendWidth + versPadding - 12)
                    .attr('height', height + 10)
                    .attr('y', -margin.top - 10)
                    .attr('opacity', expanded ? 1 : 0);


            }

            seriesShape
                .style('fill', setBGColor)
                .style('fill-opacity', setBGOpacity)
                .style('stroke', setBGColor);
        });

        function setTextColor(d,i) {
            if(vers != 'furious') return '#000';
            if(expanded) {
                return d.disengaged ? '#000' : '#fff';
            } else if (!expanded) {
                if(!d.color) d.color = color(d,i);
                return !!d.disabled ? d.color : '#fff';
            }
        }

        function setBGColor(d,i) {
            if(expanded && vers == 'furious') {
                return d.disengaged ? '#eee' : d.color || color(d,i);
            } else {
                return d.color || color(d,i);
            }
        }


        function setBGOpacity(d,i) {
            if(expanded && vers == 'furious') {
                return 1;
            } else {
                return !!d.disabled ? 0 : 1;
            }
        }

        return chart;
    }

    //============================================================
    // Expose Public Variables
    //------------------------------------------------------------

    chart.dispatch = dispatch;
    chart.options = nv.utils.optionsFunc.bind(chart);

    chart._options = Object.create({}, {
        // simple options, just get/set the necessary values
        width:          {get: function(){return width;}, set: function(_){width=_;}},
        height:         {get: function(){return height;}, set: function(_){height=_;}},
        key:            {get: function(){return getKey;}, set: function(_){getKey=_;}},
        keyFormatter:   {get: function(){return keyFormatter;}, set: function(_){keyFormatter=_;}},
        align:          {get: function(){return align;}, set: function(_){align=_;}},
        maxKeyLength:   {get: function(){return maxKeyLength;}, set: function(_){maxKeyLength=_;}},
        rightAlign:     {get: function(){return rightAlign;}, set: function(_){rightAlign=_;}},
        padding:        {get: function(){return padding;}, set: function(_){padding=_;}},
        updateState:    {get: function(){return updateState;}, set: function(_){updateState=_;}},
        enableDoubleClick: {get: function(){return enableDoubleClick;}, set: function(_){enableDoubleClick=_;}},
        radioButtonMode:{get: function(){return radioButtonMode;}, set: function(_){radioButtonMode=_;}},
        expanded:       {get: function(){return expanded;}, set: function(_){expanded=_;}},
        vers:           {get: function(){return vers;}, set: function(_){vers=_;}},

        // options that require extra logic in the setter
        margin: {get: function(){return margin;}, set: function(_){
            margin.top    = _.top    !== undefined ? _.top    : margin.top;
            margin.right  = _.right  !== undefined ? _.right  : margin.right;
            margin.bottom = _.bottom !== undefined ? _.bottom : margin.bottom;
            margin.left   = _.left   !== undefined ? _.left   : margin.left;
        }},
        color:  {get: function(){return color;}, set: function(_){
            color = nv.utils.getColor(_);
        }}
    });

    nv.utils.initOptions(chart);

    return chart;
};
