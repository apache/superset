var helper = require('./legend');

module.exports = function(){

  var scale = d3.scale.linear(),
    shape = "path",
    shapeWidth = 15,
    shapeHeight = 15,
    shapeRadius = 10,
    shapePadding = 5,
    cells = [5],
    labels = [],
    classPrefix = "",
    useClass = false,
    title = "",
    labelFormat = d3.format(".01f"),
    labelAlign = "middle",
    labelOffset = 10,
    labelDelimiter = "to",
    orient = "vertical",
    ascending = false,
    legendDispatcher = d3.dispatch("cellover", "cellout", "cellclick");

    function legend(svg){

      var type = helper.d3_calcType(scale, ascending, cells, labels, labelFormat, labelDelimiter),
        legendG = svg.selectAll('g').data([scale]);

      legendG.enter().append('g').attr('class', classPrefix + 'legendCells');

      var cell = legendG.selectAll("." + classPrefix + "cell").data(type.data),
        cellEnter = cell.enter().append("g", ".cell").attr("class", classPrefix + "cell").style("opacity", 1e-6),
        shapeEnter = cellEnter.append(shape).attr("class", classPrefix + "swatch"),
        shapes = cell.select("g." + classPrefix + "cell " + shape);

      //add event handlers
      helper.d3_addEvents(cellEnter, legendDispatcher);

      //remove old shapes
      cell.exit().transition().style("opacity", 0).remove();

      helper.d3_drawShapes(shape, shapes, shapeHeight, shapeWidth, shapeRadius, type.feature);
      helper.d3_addText(legendG, cellEnter, type.labels, classPrefix)

      // sets placement
      var text = cell.select("text"),
        shapeSize = shapes[0].map( function(d){ return d.getBBox(); });

      var maxH = d3.max(shapeSize, function(d){ return d.height; }),
      maxW = d3.max(shapeSize, function(d){ return d.width; });

      var cellTrans,
      textTrans,
      textAlign = (labelAlign == "start") ? 0 : (labelAlign == "middle") ? 0.5 : 1;

      //positions cells and text
      if (orient === "vertical"){
        cellTrans = function(d,i) { return "translate(0, " + (i * (maxH + shapePadding)) + ")"; };
        textTrans = function(d,i) { return "translate(" + (maxW + labelOffset) + "," +
              (shapeSize[i].y + shapeSize[i].height/2 + 5) + ")"; };

      } else if (orient === "horizontal"){
        cellTrans = function(d,i) { return "translate(" + (i * (maxW + shapePadding)) + ",0)"; };
        textTrans = function(d,i) { return "translate(" + (shapeSize[i].width*textAlign  + shapeSize[i].x) + "," +
              (maxH + labelOffset ) + ")"; };
      }

      helper.d3_placement(orient, cell, cellTrans, text, textTrans, labelAlign);
      helper.d3_title(svg, legendG, title, classPrefix);
      cell.transition().style("opacity", 1);

    }


  legend.scale = function(_) {
    if (!arguments.length) return scale;
    scale = _;
    return legend;
  };

  legend.cells = function(_) {
    if (!arguments.length) return cells;
    if (_.length > 1 || _ >= 2 ){
      cells = _;
    }
    return legend;
  };

  legend.shapePadding = function(_) {
    if (!arguments.length) return shapePadding;
    shapePadding = +_;
    return legend;
  };

  legend.labels = function(_) {
    if (!arguments.length) return labels;
    labels = _;
    return legend;
  };

  legend.labelAlign = function(_) {
    if (!arguments.length) return labelAlign;
    if (_ == "start" || _ == "end" || _ == "middle") {
      labelAlign = _;
    }
    return legend;
  };

  legend.labelFormat = function(_) {
    if (!arguments.length) return labelFormat;
    labelFormat = _;
    return legend;
  };

  legend.labelOffset = function(_) {
    if (!arguments.length) return labelOffset;
    labelOffset = +_;
    return legend;
  };

  legend.labelDelimiter = function(_) {
    if (!arguments.length) return labelDelimiter;
    labelDelimiter = _;
    return legend;
  };

  legend.orient = function(_){
    if (!arguments.length) return orient;
    _ = _.toLowerCase();
    if (_ == "horizontal" || _ == "vertical") {
      orient = _;
    }
    return legend;
  };

  legend.ascending = function(_) {
    if (!arguments.length) return ascending;
    ascending = !!_;
    return legend;
  };

  legend.classPrefix = function(_) {
    if (!arguments.length) return classPrefix;
    classPrefix = _;
    return legend;
  };

  legend.title = function(_) {
    if (!arguments.length) return title;
    title = _;
    return legend;
  };

  d3.rebind(legend, legendDispatcher, "on");

  return legend;

};
