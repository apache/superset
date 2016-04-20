var d3 = window.d3 || require('d3');
var px = require('../javascripts/modules/caravel.js');
var wrapSvgText = require('../javascripts/modules/utils.js').wrapSvgText;

require('./sunburst.css');

// Modified from http://bl.ocks.org/kerryrodden/7090426
function sunburstVis(slice) {
  var container = d3.select(slice.selector);

  var render = function () {
    // vars with shared scope within this function
    var margin = { top: 10, right: 5, bottom: 10, left: 5 };
    var containerWidth   = slice.width();
    var containerHeight  = slice.height();
    var breadcrumbHeight = containerHeight * 0.085;
    var visWidth         = containerWidth - margin.left - margin.right;
    var visHeight        = containerHeight - margin.top - margin.bottom - breadcrumbHeight;
    var radius           = Math.min(visWidth, visHeight) / 2;
    var colorByCategory  = true; // color by category if primary/secondary metrics match

    var maxBreadcrumbs, breadcrumbDims, // set based on data
        totalSize, // total size of all segments; set after loading the data.
        colorScale,
        breadcrumbs, vis, arcs, gMiddleText; // dom handles

    // Helper + path gen functions
    var partition = d3.layout.partition()
      .size([2 * Math.PI, radius * radius])
      .value(function (d) { return d.m1; });

    var arc = d3.svg.arc()
      .startAngle(function (d) {
        return d.x;
      })
      .endAngle(function (d) {
        return d.x + d.dx;
      })
      .innerRadius(function (d) {
        return Math.sqrt(d.y);
      })
      .outerRadius(function (d) {
        return Math.sqrt(d.y + d.dy);
      });

    var formatNum = d3.format(".3s");
    var formatPerc = d3.format(".3p");

    container.select("svg").remove();

    var svg = container.append("svg:svg")
      .attr("width", containerWidth)
      .attr("height", containerHeight);

    d3.json(slice.jsonEndpoint(), function (error, rawData) {
      if (error !== null) {
        slice.error(error.responseText);
        return '';
      }

      createBreadcrumbs(rawData);
      createVisualization(rawData);

      slice.done(rawData);
    });

    function createBreadcrumbs(rawData) {
      var firstRowData = rawData.data[0];
      maxBreadcrumbs = (firstRowData.length - 2) + 1; // -2 bc row contains 2x metrics, +extra for %label and buffer

      breadcrumbDims = {
        width: visWidth / maxBreadcrumbs,
        height: breadcrumbHeight *0.8, // more margin
        spacing: 3,
        tipTailWidth: 10
      };

      breadcrumbs = svg.append("svg:g")
        .attr("class", "breadcrumbs")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

      breadcrumbs.append("svg:text")
        .attr("class", "end-label");
    }

    // Main function to draw and set up the visualization, once we have the data.
    function createVisualization(rawData) {
      var tree = buildHierarchy(rawData.data);

      vis = svg.append("svg:g")
        .attr("class", "sunburst-vis")
        .attr("transform", "translate(" + (margin.left + (visWidth / 2)) + "," + (margin.top + breadcrumbHeight + (visHeight / 2)) + ")")
        .on("mouseleave", mouseleave);

      arcs = vis.append("svg:g")
        .attr("id", "arcs");

      gMiddleText = vis.append("svg:g")
        .attr("class", "center-label");

      // Bounding circle underneath the sunburst, to make it easier to detect
      // when the mouse leaves the parent g.
      arcs.append("svg:circle")
        .attr("r", radius)
        .style("opacity", 0);

      // For efficiency, filter nodes to keep only those large enough to see.
      var nodes = partition.nodes(tree)
        .filter(function (d) {
          return (d.dx > 0.005); // 0.005 radians = 0.29 degrees
        });

      var ext;

      if (rawData.form_data.metric !== rawData.form_data.secondary_metric) {
        colorByCategory = false;

        ext = d3.extent(nodes, function (d) {
          return d.m2 / d.m1;
        });

        colorScale = d3.scale.linear()
          .domain([ext[0], ext[0] + ((ext[1] - ext[0]) / 2), ext[1]])
          .range(["#00D1C1", "white", "#FFB400"]);
      }

      var path = arcs.data([tree]).selectAll("path")
        .data(nodes)
       .enter().append("svg:path")
        .attr("display", function (d) {
          return d.depth ? null : "none";
        })
        .attr("d", arc)
        .attr("fill-rule", "evenodd")
        .style("fill", function (d) {
          return colorByCategory ? px.color.category21(d.name) : colorScale(d.m2 / d.m1);
        })
        .style("opacity", 1)
        .on("mouseenter", mouseenter);

      // Get total size of the tree = value of root node from partition.
      totalSize = path.node().__data__.value;
    }

    // Fade all but the current sequence, and show it in the breadcrumb trail.
    function mouseenter(d) {

      var sequenceArray = getAncestors(d);
      var parentOfD = sequenceArray[sequenceArray.length - 2] || null;

      var absolutePercentage = (d.m1 / totalSize).toPrecision(3);
      var conditionalPercentage = parentOfD ? (d.m1 / parentOfD.m1).toPrecision(3) : null;

      var absolutePercString = formatPerc(absolutePercentage);
      var conditionalPercString = parentOfD ? formatPerc(conditionalPercentage) : "";

      var yOffsets = ["-25", "7", "35", "60"]; // 3 levels of text if inner-most level, 4 otherwise
      var offsetIndex = 0;

      // If metrics match, assume we are coloring by category
      var metricsMatch = Math.abs(d.m1 - d.m2) < 0.00001;

      gMiddleText.selectAll("*").remove();

      gMiddleText.append("text")
        .attr("class", "path-abs-percent")
        .attr("y", yOffsets[offsetIndex++])
        .text(absolutePercString + " of total");

      if (conditionalPercString) {
        gMiddleText.append("text")
          .attr("class", "path-cond-percent")
          .attr("y", yOffsets[offsetIndex++])
          .text(conditionalPercString + " of parent");
      }

      gMiddleText.append("text")
        .attr("class", "path-metrics")
        .attr("y", yOffsets[offsetIndex++])
        .text("m1: " + formatNum(d.m1) + (metricsMatch ? "" : ", m2: " + formatNum(d.m2)));

      gMiddleText.append("text")
        .attr("class", "path-ratio")
        .attr("y", yOffsets[offsetIndex++])
        .text((metricsMatch ? "" : ("m2/m1: " + formatPerc(d.m2 / d.m1))) );

      // Reset and fade all the segments.
      arcs.selectAll("path")
        .style("stroke-width", null)
        .style("stroke", null)
        .style("opacity", 0.7);

      // Then highlight only those that are an ancestor of the current segment.
      arcs.selectAll("path")
        .filter(function (node) {
          return (sequenceArray.indexOf(node) >= 0);
        })
        .style("opacity", 1)
        .style("stroke-width", "2px")
        .style("stroke", "#000");

      updateBreadcrumbs(sequenceArray, absolutePercString);
    }

    // Restore everything to full opacity when moving off the visualization.
    function mouseleave(d) {

      // Hide the breadcrumb trail
      breadcrumbs.style("visibility", "hidden");

      gMiddleText.selectAll("*").remove();

      // Deactivate all segments during transition.
      arcs.selectAll("path").on("mouseenter", null);
      //gMiddleText.selectAll("*").remove();

      // Transition each segment to full opacity and then reactivate it.
      arcs.selectAll("path")
        .transition()
        .duration(200)
        .style("opacity", 1)
        .style("stroke", null)
        .style("stroke-width", null)
        .each("end", function () {
          d3.select(this).on("mouseenter", mouseenter);
        });
    }

    // Given a node in a partition layout, return an array of all of its ancestor
    // nodes, highest first, but excluding the root.
    function getAncestors(node) {
      var path = [];
      var current = node;
      while (current.parent) {
        path.unshift(current);
        current = current.parent;
      }
      return path;
    }

    // Generate a string that describes the points of a breadcrumb polygon.
    function breadcrumbPoints(d, i) {
      var points = [];
      points.push("0,0");
      points.push(breadcrumbDims.width + ",0");
      points.push(breadcrumbDims.width + breadcrumbDims.tipTailWidth + "," + (breadcrumbDims.height / 2));
      points.push(breadcrumbDims.width+ "," + breadcrumbDims.height);
      points.push("0," + breadcrumbDims.height);
      if (i > 0) { // Leftmost breadcrumb; don't include 6th vertex.
        points.push(breadcrumbDims.tipTailWidth + "," + (breadcrumbDims.height / 2));
      }
      return points.join(" ");
    }

    function updateBreadcrumbs(sequenceArray, percentageString) {
      var g = breadcrumbs.selectAll("g")
        .data(sequenceArray, function (d) {
          return d.name + d.depth;
        });

      // Add breadcrumb and label for entering nodes.
      var entering = g.enter().append("svg:g");

      entering.append("svg:polygon")
          .attr("points", breadcrumbPoints)
          .style("fill", function (d) {
            return colorByCategory ? px.color.category21(d.name) : colorScale(d.m2 / d.m1);
          });

      entering.append("svg:text")
          .attr("x", (breadcrumbDims.width + breadcrumbDims.tipTailWidth) / 2)
          .attr("y", breadcrumbDims.height / 4)
          .attr("dy", "0.35em")
          .attr("class", "step-label")
          .text(function (d) { return d.name; })
          .call(wrapSvgText, breadcrumbDims.width, breadcrumbDims.height / 2);

      // Set position for entering and updating nodes.
      g.attr("transform", function (d, i) {
        return "translate(" + i * (breadcrumbDims.width + breadcrumbDims.spacing) + ", 0)";
      });

      // Remove exiting nodes.
      g.exit().remove();

      // Now move and update the percentage at the end.
      breadcrumbs.select(".end-label")
          .attr("x", (sequenceArray.length + 0.5) * (breadcrumbDims.width + breadcrumbDims.spacing))
          .attr("y", breadcrumbDims.height / 2)
          .attr("dy", "0.35em")
          .text(percentageString);

      // Make the breadcrumb trail visible, if it's hidden.
      breadcrumbs.style("visibility", null);
    }

    function buildHierarchy(rows) {
      var root = {
        name: "root",
        children: []
      };
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var m1 = Number(row[row.length - 2]);
        var m2 = Number(row[row.length - 1]);
        var levels = row.slice(0, row.length - 2);
        if (isNaN(m1)) { // e.g. if this is a header row
          continue;
        }
        var currentNode = root;
        for (var j = 0; j < levels.length; j++) {
          var children = currentNode.children || [];
          var nodeName = levels[j];
          // If the next node has the name "0", it will
          var isLeafNode = (j >= levels.length - 1) || levels[j+1] === 0;
          var childNode;

          if (!isLeafNode) {
            // Not yet at the end of the sequence; move down the tree.
            var foundChild = false;
            for (var k = 0; k < children.length; k++) {
              if (children[k].name === nodeName) {
                childNode = children[k];
                foundChild = true;
                break;
              }
            }
            // If we don't already have a child node for this branch, create it.
            if (!foundChild) {
              childNode = {
                name: nodeName,
                children: []
              };
              children.push(childNode);
            }
            currentNode = childNode;
          } else if (nodeName !== 0) {
            // Reached the end of the sequence; create a leaf node.
            childNode = {
              name: nodeName,
              m1: m1,
              m2: m2
            };
            children.push(childNode);
          }
        }
      }

      function recurse(node) {
        if (node.children) {
          var sums;
          var m1 = 0;
          var m2 = 0;
          for (var i = 0; i < node.children.length; i++) {
            sums = recurse(node.children[i]);
            m1 += sums[0];
            m2 += sums[1];
          }
          node.m1 = m1;
          node.m2 = m2;
        }
        return [node.m1, node.m2];
      }
      recurse(root);
      return root;
    }
  };

  return {
    render: render,
    resize: render
  };
}

module.exports = sunburstVis;
