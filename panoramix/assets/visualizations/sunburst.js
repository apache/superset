var d3 = window.d3 || require('d3');
require('./sunburst.css');

// Modified from http://bl.ocks.org/kerryrodden/7090426

function sunburstVis(slice) {
  var container = d3.select(slice.selector);
  var render = function () {
    var width = slice.width();
    var height = slice.height() - 5;

    // Total size of all segments; we set this later, after loading the data.
    var totalSize = 0;
    var radius = Math.min(width, height) / 2;

    container.select("svg").remove();

    var vis = container.append("svg:svg")
      .attr("width", width)
      .attr("height", height)
      .append("svg:g")
      .attr("id", "container")
      .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

    var arcs = vis.append("svg:g").attr("id", "arcs");
    var gMiddleText = vis.append("svg:g").attr("id", "gMiddleText");

    var partition = d3.layout.partition()
      .size([2 * Math.PI, radius * radius])
      .value(function (d) {
        return d.m1;
      });

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

    var ext;
    d3.json(slice.jsonEndpoint(), function (error, json) {

      if (error !== null) {
        slice.error(error.responseText);
        return '';
      }
      var tree = buildHierarchy(json.data);

      createVisualization(tree);
      slice.done(json);
    });

    // Main function to draw and set up the visualization, once we have the data.
    function createVisualization(json) {

      // Bounding circle underneath the sunburst, to make it easier to detect
      // when the mouse leaves the parent g.
      arcs.append("svg:circle")
        .attr("r", radius)
        .style("opacity", 0);

      // For efficiency, filter nodes to keep only those large enough to see.
      var nodes = partition.nodes(json)
        .filter(function (d) {
          return (d.dx > 0.005); // 0.005 radians = 0.29 degrees
        });
      ext = d3.extent(nodes, function (d) {
        return d.m2 / d.m1;
      });

      var colorScale = d3.scale.linear()
        .domain([ext[0], ext[0] + ((ext[1] - ext[0]) / 2), ext[1]])
        .range(["#00D1C1", "white", "#FFB400"]);

      var path = arcs.data([json]).selectAll("path")
        .data(nodes)
        .enter().append("svg:path")
        .attr("display", function (d) {
          return d.depth ? null : "none";
        })
        .attr("d", arc)
        .attr("fill-rule", "evenodd")
        .style("stroke", "grey")
        .style("stroke-width", "1px")
        .style("fill", function (d) {
          return colorScale(d.m2 / d.m1);
        })
        .style("opacity", 1)
        .on("mouseenter", mouseenter);

      // Add the mouseleave handler to the bounding circle.
      container.select("#container").on("mouseleave", mouseleave);

      // Get total size of the tree = value of root node from partition.
      totalSize = path.node().__data__.value;
    }
    var f = d3.format(".3s");
    var fp = d3.format(".3p");

    // Fade all but the current sequence, and show it in the breadcrumb trail.
    function mouseenter(d) {

      var percentage = (d.m1 / totalSize).toPrecision(3);
      var percentageString = fp(percentage);

      gMiddleText.selectAll("*").remove();
      gMiddleText.append("text")
        .classed("middle", true)
        .style("font-size", "50px")
        .text(percentageString);

      gMiddleText.append("text")
        .classed("middle", true)
        .style("font-size", "20px")
        .attr("y", "25")
        .text("m1: " + f(d.m1) + " | m2: " + f(d.m2));

      gMiddleText.append("text")
        .classed("middle", true)
        .style("font-size", "15px")
        .attr("y", "50")
        .text("m2/m1: " + fp(d.m2 / d.m1));

      var sequenceArray = getAncestors(d);

      // Update the breadcrumb trail to show the current sequence and percentage.
      function updateBreadcrumbs(nodeArray) {
        var l = [];
        for (var i = 0; i < nodeArray.length; i++) {
          l.push(nodeArray[i].name);
        }
        var s = l.join(' > ');
        gMiddleText.append("text")
          .text(s)
          .classed("middle", true)
          .attr("y", -75);
      }
      updateBreadcrumbs(sequenceArray);

      // Fade all the segments.
      arcs.selectAll("path")
        .style("stroke-width", "1px")
        .style("opacity", 0.3);

      // Then highlight only those that are an ancestor of the current segment.
      arcs.selectAll("path")
        .filter(function (node) {
          return (sequenceArray.indexOf(node) >= 0);
        })
        .style("opacity", 1)
        .style("stroke", "#888")
        .style("stroke-width", "2px");
    }

    // Restore everything to full opacity when moving off the visualization.
    function mouseleave(d) {

      // Hide the breadcrumb trail
      arcs.select("#trail")
        .style("visibility", "hidden");

      gMiddleText.selectAll("*").remove();

      // Deactivate all segments during transition.
      arcs.selectAll("path").on("mouseenter", null);
      //gMiddleText.selectAll("*").remove();

      // Transition each segment to full opacity and then reactivate it.
      arcs.selectAll("path")
        .transition()
        .duration(200)
        .style("opacity", 1)
        .style("stroke", "grey")
        .style("stroke-width", "1px")
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

    function buildHierarchy(rows) {
      var root = {
        name: "root",
        children: []
      };
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var m1 = Number(row[row.length - 2]);
        var m2 = Number(row[row.length - 1]);
        var parts = row.slice(0, row.length - 2);
        if (isNaN(m1)) { // e.g. if this is a header row
          continue;
        }
        var currentNode = root;
        for (var j = 0; j < parts.length; j++) {
          var children = currentNode.children;
          var nodeName = parts[j];
          var childNode;
          if (j + 1 < parts.length) {
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
          } else {
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
