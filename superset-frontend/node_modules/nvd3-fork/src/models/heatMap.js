/* 
Improvements:
- consistenly apply no-hover classes to rect isntead of to containing g, see example CSS style for .no-hover rect, rect.no-hover
- row/column order (user specified) or 'ascending' / 'descending'
- I haven't tested for transitions between changing datasets
*/

nv.models.heatMap = function() {
    "use strict";

    //============================================================
    // Public Variables with Default Settings
    //------------------------------------------------------------

    var margin = {top: 0, right: 0, bottom: 0, left: 0}
        , width = 960
        , height = 500
        , id = Math.floor(Math.random() * 10000) //Create semi-unique ID in case user doesn't select one
        , container
        , xScale = d3.scale.ordinal()
        , yScale = d3.scale.ordinal()
        , colorScale = false
        , getX = function(d) { return d.x }
        , getY = function(d) { return d.y }
        , getCellValue = function(d) { return d.value }
        , showCellValues = true
        , cellValueFormat = function(d) { return typeof d === 'number' ? d.toFixed(0) : d }
        , cellAspectRatio = false // width / height of cell
        , cellRadius = 2
        , cellBorderWidth = 4 // pixels between cells
        , normalize = false
        , highContrastText = true
        , xDomain
        , yDomain
        , xMetaColorScale = nv.utils.defaultColor()
        , yMetaColorScale = nv.utils.defaultColor()
        , missingDataColor = '#bcbcbc'
        , missingDataLabel = ''
        , metaOffset = 5 // spacing between meta rects and cells
        , xRange
        , yRange
        , xMeta
        , yMeta
        , colorRange
        , colorDomain
        , dispatch = d3.dispatch('chartClick', 'elementClick', 'elementDblClick', 'elementMouseover', 'elementMouseout', 'elementMousemove', 'renderEnd')
        , duration = 250
        , xMetaHeight = function(d) { return cellHeight / 3 }
        , yMetaWidth = function(d) { return cellWidth / 3 }
        , showGrid = false
        ;



    //============================================================
    // Aux helper function for heatmap
    //------------------------------------------------------------
    // choose high contrast text color based on background
    // shameful steal: https://github.com/alexandersimoes/d3plus/blob/master/src/color/text.coffee
    function cellTextColor(bgColor) {

        if (highContrastText) {
            var rgbColor = d3.rgb(bgColor);
            var r = rgbColor.r;
            var g = rgbColor.g;
            var b = rgbColor.b;
            var yiq = (r * 299 + g * 587 + b * 114) / 1000;
            return yiq >= 128 ? "#404040" : "#EDEDED"; // dark text else light text
        } else {
            return 'black';
        }
    }

    /* go through heatmap data and generate array of values
     * for each row/column or for entire dataset; for use in
     * calculating means/medians of data for normalizing
     * @param {str} axis - 'row', 'col' or null
     *
     * @returns {row/column index: [array of values for row/col]}
     * note that if axis is not specified, the return will be
     * {0: [all values in heatmap]}
     */
    function getHeatmapValues(data, axis) {
        var vals = {};

        data.forEach(function(cell, i) {
            if (axis == 'row') {
                if (!(getIY(cell) in vals)) vals[getIY(cell)] = [];
                vals[getIY(cell)].push(getCellValue(cell));
            } else if (axis == 'col') {
                if (!(getIX(cell) in vals)) vals[getIX(cell)] = [];
                vals[getIX(cell)].push(getCellValue(cell));
            } else if (axis == null) { // if calculating stat over entire dataset
                if (!(0 in vals)) vals[0] = [];
                vals[0].push(getCellValue(cell)); 
            }
        })

        return vals;
    }

    // calculate the median absolute deviation of the given array of data
    // https://en.wikipedia.org/wiki/Median_absolute_deviation
    // MAD = median(abs(Xi - median(X)))
    function mad(dat) {
        var med = d3.median(dat);
        var vals = dat.map(function(d) { return Math.abs(d - med); })
        return d3.median(vals);
    }


    // set cell color based on cell value
    // depending on whether it should be normalized or not
    function cellColor(d) {
        var colorVal = normalize ? getNorm(d) : getCellValue(d);
        return (cellsAreNumeric() && !isNaN(colorVal) || typeof colorVal !== 'undefined') ? colorScale(colorVal) : missingDataColor;
    }

    // return the domain of the color data
    // if ordinal data is given for the cells, this will
    // return all possible cells values; otherwise it
    // returns the extent of the cell values
    // will take into account normalization if specified
    function getColorDomain() {
    
        if (cellsAreNumeric()) { // if cell values are numeric
            return normalize ? d3.extent(prepedData, function(d) { return getNorm(d); }) : d3.extent(uniqueColor);
        } else if (!cellsAreNumeric()) { // if cell values are ordinal
            return uniqueColor;
        }
    }

    // return true if cells are numeric
    // as opposed to categorical
    function cellsAreNumeric() {
        return typeof uniqueColor[0] === 'number';
    }

    /*
     * Normalize input data
     *
     * normalize must be one of centerX, robustCenterX, centerScaleX, robustCenterScaleX, centerAll, 
     * robustCenterAll, centerScaleAll, robustCenterScaleAll where X is either 'Row' or 'Column'
     *
     * - centerX: subtract row/column mean from cell
     * - centerAll: subtract mean of whole data set from cell
     * - centerScaleX: scale so that row/column has mean 0 and variance 1 (Z-score)
     * - centerScaleAll: scale by overall normalization factor so that the whole data set has mean 0 and variance 1 (Z-score)
     * - robustCenterX: subtract row/column median from cell
     * - robustCenterScaleX: subtract row/column median from cell and then scale row/column by median absolute deviation
     * - robustCenterAll: subtract median of whole data set from cell
     * - robustCenterScaleAll: subtract overall median from cell and scale by overall median absolute deviation
     */
    function normalizeData(dat) {
        
        var normTypes = ['centerRow',
            'robustCenterRow',
            'centerScaleRow',
            'robustCenterScaleRow',
            'centerColumn',
            'robustCenterColumn',
            'centerScaleColumn',
            'robustCenterScaleColumn',
            'centerAll',
            'robustCenterAll',
            'centerScaleAll',
            'robustCenterScaleAll'];


        if(normTypes.indexOf(normalize) != -1) {

            var xVals = Object.keys(uniqueX), yVals = Object.keys(uniqueY);

            // setup normalization options
            var scale = normalize.includes('Scale') ? true: false,
                agg = normalize.includes('robust') ? 'median': 'mean',
                axis = normalize.includes('Row') ? 'row' : normalize.includes('Column') ? 'col' : null,
                vals = getHeatmapValues(dat, axis);

            // calculate mean or median
            // calculate standard dev or median absolute deviation
            var stat = {};
            var dev = {};
            for (var key in vals) {
                stat[key] = agg == 'mean' ? d3.mean(vals[key]) : d3.median(vals[key]);
                if (scale) dev[key] = agg == 'mean' ? d3.deviation(vals[key]) : mad(vals[key]);
            }


            // do the normalizing
            dat.forEach(function(cell, i) {
                if (cellsAreNumeric()) {
                    if (axis == 'row') {
                        var key = getIY(cell);
                    } else if (axis == 'col') {
                        var key = getIX(cell);
                    } else if (axis == null) {  // if calculating stat over entire dataset
                        var key = 0;
                    }

                    var normVal = getCellValue(cell) - stat[key];
                    if (scale) {
                        cell._cellPos.norm = normVal / dev[key];
                    } else {
                        cell._cellPos.norm = normVal;
                    }
                } else {
                    cell._cellPos.norm = getCellValue(cell); // if trying to normalize ordinal cells, just set norm to cell value
                }
            })

        } else {
            normalize = false; // proper normalize option was not provided, disable it so heatmap still shows colors
        }

        return dat;
    }

    /*
     * Process incoming data for use with heatmap including:
     * - adding a unique key indexer to each data point (idx)
     * - getting a unique list of all x & y values
     * - generating a position index (x & y) for each data point
     * - sorting that data for correct traversal when generating rect
     * - generating placeholders for missing data
     *
     * In order to allow for the flexibility of the user providing either
     * categorical or quantitative data, we're going to position the cells
     * through indices that we increment based on previously seen data
     * this way we can use ordinal() axes even if the data is quantitative.
     *
     * When we generate the SVG elements, we assumes traversal occures from
     * top to bottom and from left to right.
     *
     * @param data {list} - input data organize as a list of objects
     *
     * @return - copy of input data with additional '_cellPos' key
     *           formatted as {idx: XXX, ix, XXX, iy: XXX}
     *           where idx is a global identifier; ix is an identifier
     *           within each column, and iy is an identifier within
     *           each row. 
     */
    function prepData(data) {

        // reinitialize
        uniqueX = {}, // {cell x value: ix index}
        uniqueY = {}, // {cell y value: iy index}
        uniqueColor = [], // [cell color value]
        uniqueXMeta = [], // [cell x metadata value]
        uniqueYMeta = [], // [cell y metadata value]
        uniqueCells = []; // [cell x,y values stored as array]
        var warnings = [];
        var sortedCells = {}; // {cell x values: {cell y value: cell data, ... }, ... }

        var ix = 0, iy = 0; // use these indices to position cell in x & y direction
        var combo, idx=0;
        data.forEach(function(cell) {
            var valX = getX(cell),
                valY = getY(cell),
                valColor = getCellValue(cell);            

            // assemble list of unique values for each dimension
            if (!(valX in uniqueX)) { 
                uniqueX[valX] = ix; 
                ix++;

                sortedCells[valX] = {}

                if (typeof xMeta === 'function') uniqueXMeta.push(xMeta(cell));
            }

            if (!(valY in uniqueY)) {
                uniqueY[valY] = iy; 
                iy++;

                sortedCells[valX][valY] = {}

                if (typeof yMeta === 'function') uniqueYMeta.push(yMeta(cell));
            }
            if (uniqueColor.indexOf(valColor) == -1) uniqueColor.push(valColor)


            // for each data point, we generate an object of data
            // needed to properly position each cell
            cell._cellPos = {
                idx: idx,
                ix: uniqueX[valX],
                iy: uniqueY[valY],
            }
            idx++;


            // keep track of row & column combinations we've already seen
            // this prevents the same cells from being generated when
            // the user hasn't provided proper data (one value for each
            // row & column).
            // if properly formatted data is not provided, only the first
            // row & column value is used (the rest are ignored)
            combo = [valX, valY];
            if (!isArrayInArray(uniqueCells, combo)) {
                uniqueCells.push(combo)
                sortedCells[valX][valY] = cell;
            } else if (warnings.indexOf(valX + valY) == -1) {
                warnings.push(valX + valY);
                console.warn("The row/column position " + valX + "/" + valY + " has multiple values; ensure each cell has only a single value.");
            }

        });

        uniqueColor = uniqueColor.sort()

        // check in sortedCells that each x has all the y's
        // if not, generate an empty placeholder
        // this will also sort all cells from left to right
        // and top to bottom
        var reformatData = [];
        Object.keys(uniqueY).forEach(function(j) {
            Object.keys(uniqueX).forEach(function(i) {
                var cellVal = sortedCells[i][j];
    
                if (cellVal) {
                    reformatData.push(cellVal);
                } else {
                    var cellPos = {
                        idx: idx,
                        ix: uniqueX[i],
                        iy: uniqueY[j],
                    }
                    idx++;
                    reformatData.push({_cellPos: cellPos}); // empty cell placeholder
                }
            })
        })


        // normalize data is needed
        return normalize ? normalizeData(reformatData) : reformatData;

    }

    // https://stackoverflow.com/a/41661388/1153897
    function isArrayInArray(arr, item){
      var item_as_string = JSON.stringify(item);

      var contains = arr.some(function(ele){
        return JSON.stringify(ele) === item_as_string;
      });
      return contains;
    }

    function removeAllHoverClasses() {
        // remove all hover classes
        d3.selectAll('.cell-hover').classed('cell-hover', false);
        d3.selectAll('.no-hover').classed('no-hover', false);
        d3.selectAll('.row-hover').classed('row-hover', false);
        d3.selectAll('.column-hover').classed('column-hover', false);
    }

    // return the formatted cell value if it is
    // a number, otherwise return missingDataLabel
    var cellValueLabel = function(d) {
        var val = !normalize ? cellValueFormat(getCellValue(d)) : cellValueFormat(getNorm(d));
        return (cellsAreNumeric() && !isNaN(val) || typeof val !== 'undefined') ? val : missingDataLabel;
    }

    // https://stackoverflow.com/a/16794116/1153897
    // note this returns the obj keys
    function sortObjByVals(obj) {
        return Object.keys(obj).sort(function(a,b){return obj[a]-obj[b]})
    }

    // https://stackoverflow.com/a/28191966/1153897
    function getKeyByValue(object, value) {
        //return Object.keys(object).find(key => object[key] === value);
        return Object.keys(object).filter(function(key) {return object[key] === value})[0];
    }


    //============================================================
    // Private Variables
    //------------------------------------------------------------

    var prepedData, cellHeight, cellWidth;
    var uniqueX = {}, uniqueY = {}, uniqueColor = [];
    var uniqueXMeta = [], uniqueYMeta = [], uniqueCells = []
    var renderWatch = nv.utils.renderWatch(dispatch, duration);
    var RdYlBu = ["#a50026","#d73027","#f46d43","#fdae61","#fee090","#ffffbf","#e0f3f8","#abd9e9","#74add1","#4575b4","#313695"];

    var getCellPos = function(d) { return d._cellPos; };
    var getIX = function(d) { return getCellPos(d).ix; } // get the given cell's x index position
    var getIY = function(d) { return getCellPos(d).iy; } // get the given cell's y index position
    var getNorm = function(d) { return getCellPos(d).norm; }
    var getIdx = function(d) { return getCellPos(d).idx; }


    function chart(selection) {
        renderWatch.reset();
        selection.each(function(data) {

            prepedData = prepData(data);

            var availableWidth = width - margin.left - margin.right,
                availableHeight = height - margin.top - margin.bottom;

            // available width/height set the cell dimenions unless
            // the aspect ratio is defined - in that case the cell
            // height is adjusted and availableHeight updated
            cellWidth = availableWidth / Object.keys(uniqueX).length;
            cellHeight = cellAspectRatio ? cellWidth / cellAspectRatio : availableHeight / Object.keys(uniqueY).length;
            if (cellAspectRatio) availableHeight = cellHeight * Object.keys(uniqueY).length - margin.top - margin.bottom;


            container = d3.select(this);
            nv.utils.initSVG(container);
  
            // Setup Scales
            xScale.domain(xDomain || sortObjByVals(uniqueX))
                  .rangeBands(xRange || [0, availableWidth-cellBorderWidth/2]);
            yScale.domain(yDomain || sortObjByVals(uniqueY))
                  .rangeBands(yRange || [0, availableHeight-cellBorderWidth/2]);
            colorScale = cellsAreNumeric() ? d3.scale.quantize() : d3.scale.ordinal();
            colorScale.domain(colorDomain || getColorDomain())
                  .range(colorRange || RdYlBu);


            // Setup containers and skeleton of chart
            var wrap = container.selectAll('g.nv-heatMapWrap').data([prepedData]);
            var wrapEnter = wrap.enter().append('g').attr('class', 'nvd3 nv-heatMapWrap');
            wrapEnter
                .append('g')
                .attr('class','cellWrap')

            wrap.watchTransition(renderWatch, 'nv-wrap: heatMapWrap')
                .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

            var gridWrap = wrapEnter
                .append('g')
                .attr('class','cellGrid')
                .style('opacity',1e-6)

            var gridLinesV = wrap.select('.cellGrid').selectAll('.gridLines.verticalGrid')
                .data(Object.values(uniqueX).concat([Object.values(uniqueX).length]))
                
            gridLinesV.enter()
                .append('line')
                .attr('class','gridLines verticalGrid')

            gridLinesV.exit()
                .remove()

            var gridLinesH = wrap.select('.cellGrid').selectAll('.gridLines.horizontalGrid')
                .data(Object.values(uniqueY).concat([Object.values(uniqueY).length]))
                
            gridLinesH.enter()
                .append('line')
                .attr('class','gridLines horizontalGrid')

            gridLinesH.exit()
                .remove()

            var cellWrap = wrap.select('.cellWrap')
                .selectAll(".nv-cell")
                .data(function(d) { return d; }, function(e) { return getIdx(e); })

            var xMetaWrap = wrapEnter
                .append('g')
                .attr('class','xMetaWrap')
                .attr("transform", function() { return "translate(0," + (-xMetaHeight()-cellBorderWidth-metaOffset) + ")" })

            var xMetas = wrap.select('.xMetaWrap').selectAll('.x-meta')
                .data(uniqueXMeta)

            var xMetaEnter = xMetas
                .enter()
                .append('rect')
                .attr('class','x-meta meta')
                .attr("width", cellWidth-cellBorderWidth)
                .attr("height", xMetaHeight())
                .attr("transform", "translate(0,0)")
                .attr("fill", function(d) { return xMetaColorScale(d); })

            var yMetaWrap = wrapEnter
                .append('g')
                .attr('class','yMetaWrap')
                .attr("transform", function(d,i) { return "translate(" + (-yMetaWidth()-cellBorderWidth-metaOffset) + ",0)" })

            var yMetas = wrap.select('.yMetaWrap').selectAll('.y-meta')
                .data(uniqueYMeta)

            var yMetaEnter = yMetas
                .enter()
                .append('rect')
                .attr('class','y-meta meta')
                .attr("width", yMetaWidth())
                .attr("height", cellHeight-cellBorderWidth)
                .attr("transform", function(d,i) { return "translate(0,0)" })
                .attr("fill", function(d,i) { return yMetaColorScale(d); })

            xMetas.exit().remove()
            yMetas.exit().remove()
          
            // CELLS    
            var cellsEnter = cellWrap
                .enter()
                .append('g')
                .style('opacity', 1e-6)
                .attr("transform", function(d) { return "translate(0," + getIY(d) * cellHeight + ")" }) // enter all g's here for a sweep-right transition
                .attr('data-row', function(d) { return getIY(d) })
                .attr('data-column', function(d) { return getIX(d) });

            cellsEnter
                .append("rect") 

            cellsEnter
                .append('text')
                .attr('text-anchor', 'middle')
                .attr("dy", 4)
                .attr("class","cell-text")

            
            // transition cell (rect) size
            cellWrap.selectAll('rect')
                .watchTransition(renderWatch, 'heatMap: rect')
                .attr("width", cellWidth-cellBorderWidth)
                .attr("height", cellHeight-cellBorderWidth)
                .attr('rx', cellRadius)
                .attr('ry', cellRadius)
                .style('stroke', function(d) { return cellColor(d) })

            // transition cell (g) position, opacity and fill
            cellWrap
                .attr("class",function(d) { return isNaN(getCellValue(d)) ? 'nv-cell cell-missing' : 'nv-cell'}) 
                .watchTransition(renderWatch, 'heatMap: cells')
                .style({
                    'opacity': 1,
                    'fill': function(d) { return cellColor(d) },
                })
                .attr("transform", function(d) { return "translate(" + getIX(d) * cellWidth + "," + getIY(d) * cellHeight + ")" })
                .attr("class",function(d) { return isNaN(getCellValue(d)) ? 'nv-cell cell-missing' : 'nv-cell'}) 

            cellWrap.exit().remove();

            // transition text position and fill
            cellWrap.selectAll('text')
                .watchTransition(renderWatch, 'heatMap: cells text')
                .text(function(d) { return cellValueLabel(d); })
                .attr("x", function(d) { return (cellWidth-cellBorderWidth) / 2; })
                .attr("y", function(d) { return (cellHeight-cellBorderWidth) / 2; })
                .style("fill", function(d) { return cellTextColor(cellColor(d)) })
                .style('opacity', function() { return showCellValues ? 1 : 0 })

            // transition grid
            wrap.selectAll('.verticalGrid')
                .watchTransition(renderWatch, 'heatMap: gridLines') 
                .attr('y1',0)
                .attr('y2',availableHeight-cellBorderWidth)
                .attr('x1',function(d) { return d*cellWidth-cellBorderWidth/2; })
                .attr('x2',function(d) { return d*cellWidth-cellBorderWidth/2; })

            var numHLines = Object.keys(uniqueY).length;
            wrap.selectAll('.horizontalGrid')
                .watchTransition(renderWatch, 'heatMap: gridLines') 
                .attr('x1',function(d) { return (d == 0 || d == numHLines) ? -cellBorderWidth : 0 })
                .attr('x2',function(d) { return (d == 0 || d == numHLines) ? availableWidth : availableWidth-cellBorderWidth})
                .attr('y1',function(d) { return d*cellHeight-cellBorderWidth/2; })
                .attr('y2',function(d) { return d*cellHeight-cellBorderWidth/2; })

            wrap.select('.cellGrid')
                .watchTransition(renderWatch, 'heatMap: gridLines')
                .style({
                    'stroke-width': cellBorderWidth,
                    'opacity': function() { return showGrid ? 1 : 1e-6 },
                })

            var xMetaRect = wrap.selectAll('.x-meta')
            var yMetaRect = wrap.selectAll('.y-meta')
            var allMetaRect = wrap.selectAll('.meta')

            // transition meta rect size
            xMetas
                .watchTransition(renderWatch, 'heatMap: xMetaRect') 
                .attr("width", cellWidth-cellBorderWidth)
                .attr("height", xMetaHeight())
                .attr("transform", function(d,i) { return "translate(" + (i * cellWidth) + ",0)" })

            yMetas
                .watchTransition(renderWatch, 'heatMap: yMetaRect') 
                .attr("width", yMetaWidth())
                .attr("height", cellHeight-cellBorderWidth)
                .attr("transform", function(d,i) { return "translate(0," + (i * cellHeight) + ")" })


            // transition position of meta wrap g & opacity
            wrap.select('.xMetaWrap')
                .watchTransition(renderWatch, 'heatMap: xMetaWrap') 
                .attr("transform", function(d,i) { return "translate(0," + (-xMetaHeight()-cellBorderWidth-metaOffset) + ")" })
                .style("opacity", function() { return xMeta !== false ? 1 : 0 })
            wrap.select('.yMetaWrap')
                .watchTransition(renderWatch, 'heatMap: yMetaWrap') 
                .attr("transform", function(d,i) { return "translate(" + (-yMetaWidth()-cellBorderWidth-metaOffset) + ",0)" })
                .style("opacity", function() { return yMeta !== false ? 1 : 0 })

            // TOOLTIPS
            cellWrap
                .on('mouseover', function(d,i) {

                    var idx = getIdx(d);
                    var ix = getIX(d);
                    var iy = getIY(d);

                    // set the proper classes for all cells
                    // hover row gets class .row-hover
                    // hover column gets class .column-hover
                    // hover cell gets class .cell-hover
                    // all remaining cells get class .no-hover
                    d3.selectAll('.nv-cell').each(function(e) {
                        if (idx == getIdx(e)) {
                            d3.select(this).classed('cell-hover', true);
                            d3.select(this).classed('no-hover', false);
                        } else {
                            d3.select(this).classed('no-hover', true);
                            d3.select(this).classed('cell-hover', false);
                        }
                        if (ix == getIX(e)) {
                            d3.select(this).classed('no-hover', false);
                            d3.select(this).classed('column-hover', true);
                        }
                        if (iy == getIY(e)) {
                            d3.select(this).classed('no-hover', false);
                            d3.select(this).classed('row-hover', true);
                        }
                    })
    
                    // set hover classes for column metadata
                    d3.selectAll('.x-meta').each(function(e, j) {
                        if (j == ix) {
                            d3.select(this).classed('cell-hover', true);
                            d3.select(this).classed('no-hover', false);
                        } else {
                            d3.select(this).classed('no-hover', true);
                            d3.select(this).classed('cell-hover', false);
                        }
                    });

                    // set hover class for row metadata
                    d3.selectAll('.y-meta').each(function(e, j) {
                        if (j == iy) {
                            d3.select(this).classed('cell-hover', true);
                            d3.select(this).classed('no-hover', false);
                        } else {
                            d3.select(this).classed('no-hover', true);
                            d3.select(this).classed('cell-hover', false);
                        }
                    });
                    
                    dispatch.elementMouseover({
                        value: getKeyByValue(uniqueX, ix) + ' & ' + getKeyByValue(uniqueY, iy), 
                        series: {
                                value: cellValueLabel(d), 
                                color: d3.select(this).select('rect').style("fill")
                                },
                        e: d3.event,
                    });

                })
                .on('mouseout', function(d,i) {

                    // allow tooltip to remain even when mouse is over the
                    // space between the cell;
                    // this prevents cells from "flashing" when transitioning
                    // between cells
                    var bBox = d3.select(this).select('rect').node().getBBox();
                    var coordinates = d3.mouse(d3.select('.nv-heatMap').node());
                    var x = coordinates[0];
                    var y = coordinates[1];

                    // we only trigger mouseout when mouse moves outside of
                    // .nv-heatMap
                    if (x + cellBorderWidth >= availableWidth || y + cellBorderWidth >= availableHeight || x < 0 || y < 0) {
                        // remove all hover classes
                        removeAllHoverClasses();

                        dispatch.elementMouseout({e: d3.event});
                    }
                })
                .on('mousemove', function(d,i) {

                    dispatch.elementMousemove({e: d3.event});
                })

            allMetaRect
                .on('mouseover', function(d,i) {

                    // true if hovering over a row metadata rect
                    var isColMeta = d3.select(this).attr('class').indexOf('x-meta') != -1 ? true : false;

                    // apply proper .row-hover & .column-hover
                    // classes to cells
                    d3.selectAll('.nv-cell').each(function(e) {

                        if (isColMeta && i == getIX(e)) {
                            d3.select(this).classed('column-hover', true);
                            d3.select(this).classed('no-hover', false);
                        } else if (!isColMeta && i-uniqueXMeta.length == getIY(e)) {
                            // since allMetaRect selects all the meta rects, the index for the y's will
                            // be offset by the number of x rects. TODO - write seperate tooltip sections
                            // for x meta rect & y meta rect
                            d3.select(this).classed('row-hover', true);
                            d3.select(this).classed('no-hover', false);
                        } else {
                            d3.select(this).classed('no-hover', true);
                            d3.select(this).classed('column-hover', false);
                            d3.select(this).classed('row-hover', false);
                        }
                        d3.select(this).classed('cell-hover', false);
                    })

                    // apply proper .row-hover & .column-hover
                    // classes to meta rects
                    d3.selectAll('.meta').classed('no-hover', true);
                    d3.select(this).classed('cell-hover', true);
                    d3.select(this).classed('no-hover', false);

                    dispatch.elementMouseover({
                        value: isColMeta ? 'Column meta' : 'Row meta',
                        series: { value: d, color: d3.select(this).style('fill'), }
                    });
                })
                .on('mouseout', function(d,i) {

                    // true if hovering over a row metadata rect
                    var isColMeta = d3.select(this).attr('class').indexOf('x-meta') != -1 ? true : false;

                    // allow tooltip to remain even when mouse is over the
                    // space between the cell;
                    // this prevents cells from "flashing" when transitioning
                    // between cells
                    var bBox = d3.select(this).node().getBBox();
                    var coordinates = d3.mouse(d3.select(isColMeta ? '.xMetaWrap' : '.yMetaWrap').node());
                    var x = coordinates[0];
                    var y = coordinates[1];

                    if ( y < 0 || x < 0 || 
                        (isColMeta && x + cellBorderWidth >= availableWidth) ||
                        (!isColMeta && y + cellBorderWidth >= availableHeight)
                    ) {
                        // remove all hover classes
                        removeAllHoverClasses();

                        dispatch.elementMouseout({e: d3.event});
                    }
                })
                .on('mousemove', function(d,i) {
                    dispatch.elementMousemove({e: d3.event});
                })

        });


        renderWatch.renderEnd('heatMap immediate');
        return chart;
    }

    //============================================================
    // Expose Public Variables
    //------------------------------------------------------------

    chart.dispatch = dispatch;
    chart.options = nv.utils.optionsFunc.bind(chart);

    chart._options = Object.create({}, {
        // simple options, just get/set the necessary values
        width:   {get: function(){return width;}, set: function(_){width=_;}},
        height:  {get: function(){return height;}, set: function(_){height=_;}},
        showCellValues: {get: function(){return showCellValues;}, set: function(_){showCellValues=_;}},
        x:       {get: function(){return getX;}, set: function(_){getX=_;}}, // data attribute for horizontal axis
        y:       {get: function(){return getY;}, set: function(_){getY=_;}}, // data attribute for vertical axis
        cellValue:       {get: function(){return getCellValue;}, set: function(_){getCellValue=_;}}, // data attribute that sets cell value and color
        missingDataColor:  {get: function(){return missingDataColor;}, set: function(_){missingDataColor=_;}},
        missingDataLabel:  {get: function(){return missingDataLabel;}, set: function(_){missingDataLabel=_;}},
        xScale:  {get: function(){return xScale;}, set: function(_){xScale=_;}},
        yScale:  {get: function(){return yScale;}, set: function(_){yScale=_;}},
        colorScale:  {get: function(){return colorScale;}, set: function(_){colorScale=_;}}, // scale to map cell values to colors
        xDomain:  {get: function(){return xDomain;}, set: function(_){xDomain=_;}},
        yDomain:  {get: function(){return yDomain;}, set: function(_){yDomain=_;}},
        xRange:  {get: function(){return xRange;}, set: function(_){xRange=_;}},
        yRange:  {get: function(){return yRange;}, set: function(_){yRange=_;}},
        colorRange:  {get: function(){return colorRange;}, set: function(_){colorRange=_;}},
        colorDomain:  {get: function(){return colorDomain;}, set: function(_){colorDomain=_;}},
        xMeta:  {get: function(){return xMeta;}, set: function(_){xMeta=_;}},
        yMeta:  {get: function(){return yMeta;}, set: function(_){yMeta=_;}},
        xMetaColorScale:  {get: function(){return color;}, set: function(_){color = nv.utils.getColor(_);}},
        yMetaColorScale:  {get: function(){return color;}, set: function(_){color = nv.utils.getColor(_);}},
        cellAspectRatio:  {get: function(){return cellAspectRatio;}, set: function(_){cellAspectRatio=_;}}, // cell width / height
        cellRadius:  {get: function(){return cellRadius;}, set: function(_){cellRadius=_;}}, // cell width / height
        cellHeight:  {get: function(){return cellHeight;}}, // TODO - should not be exposed since we don't want user setting this
        cellWidth:   {get: function(){return cellWidth;}}, // TODO - should not be exposed since we don't want user setting this
        normalize:   {get: function(){return normalize;}, set: function(_){normalize=_;}},
        cellBorderWidth:     {get: function(){return cellBorderWidth;}, set: function(_){cellBorderWidth=_;}},
        highContrastText:    {get: function(){return highContrastText;}, set: function(_){highContrastText=_;}},
        cellValueFormat:     {get: function(){return cellValueFormat;}, set: function(_){cellValueFormat=_;}},
        id:                  {get: function(){return id;}, set: function(_){id=_;}},
        metaOffset:          {get: function(){return metaOffset;}, set: function(_){metaOffset=_;}},
        xMetaHeight:         {get: function(){return xMetaHeight;}, set: function(_){xMetaHeight=_;}},
        yMetaWidth:          {get: function(){return yMetaWidth;}, set: function(_){yMetaWidth=_;}},
        showGrid:          {get: function(){return showGrid;}, set: function(_){showGrid=_;}},


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
        }}
    });

    nv.utils.initOptions(chart);


    return chart;
};
