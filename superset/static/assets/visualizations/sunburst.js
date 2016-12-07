/* eslint-disable no-underscore-dangle, no-param-reassign */
import d3 from 'd3';
import { category21 } from '../javascripts/modules/colors';
import { wrapSvgText } from '../javascripts/modules/utils';

require('./sunburst.css');

// Modified from http://bl.ocks.org/kerryrodden/7090426
function sunburstVis(slice) {
  const container = d3.select(slice.selector);

  const render = function () {
    // vars with shared scope within this function
    const margin = { top: 10, right: 5, bottom: 10, left: 5 };
    const containerWidth = slice.width();
    const containerHeight = slice.height();
    const breadcrumbHeight = containerHeight * 0.085;
    const visWidth = containerWidth - margin.left - margin.right;
    const visHeight = containerHeight - margin.top - margin.bottom - breadcrumbHeight;
    const radius = Math.min(visWidth, visHeight) / 2;

    let colorByCategory = true; // color by category if primary/secondary metrics match
    let maxBreadcrumbs;
    let breadcrumbDims; // set based on data
    let totalSize; // total size of all segments; set after loading the data.
    let colorScale;
    let breadcrumbs;
    let vis;
    let arcs;
    let gMiddleText; // dom handles

    // Helper + path gen functions
    const partition = d3.layout.partition()
      .size([2 * Math.PI, radius * radius])
      .value(function (d) { return d.m1; });

    const arc = d3.svg.arc()
      .startAngle((d) => d.x)
      .endAngle((d) => d.x + d.dx)
      .innerRadius(function (d) {
        return Math.sqrt(d.y);
      })
      .outerRadius(function (d) {
        return Math.sqrt(d.y + d.dy);
      });

    const formatNum = d3.format('.3s');
    const formatPerc = d3.format('.3p');

    container.select('svg').remove();

    const svg = container.append('svg:svg')
      .attr('width', containerWidth)
      .attr('height', containerHeight);

    function createBreadcrumbs(rawData) {
      const firstRowData = rawData.data[0];
      // -2 bc row contains 2x metrics, +extra for %label and buffer
      maxBreadcrumbs = (firstRowData.length - 2) + 1;
      breadcrumbDims = {
        width: visWidth / maxBreadcrumbs,
        height: breadcrumbHeight * 0.8, // more margin
        spacing: 3,
        tipTailWidth: 10,
      };

      breadcrumbs = svg.append('svg:g')
        .attr('class', 'breadcrumbs')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

      breadcrumbs.append('svg:text')
        .attr('class', 'end-label');
    }

    // Given a node in a partition layout, return an array of all of its ancestor
    // nodes, highest first, but excluding the root.
    function getAncestors(node) {
      const path = [];
      let current = node;
      while (current.parent) {
        path.unshift(current);
        current = current.parent;
      }
      return path;
    }

    // Generate a string that describes the points of a breadcrumb polygon.
    function breadcrumbPoints(d, i) {
      const points = [];
      points.push('0,0');
      points.push(breadcrumbDims.width + ',0');
      points.push(
        breadcrumbDims.width + breadcrumbDims.tipTailWidth + ',' + (breadcrumbDims.height / 2));
      points.push(breadcrumbDims.width + ',' + breadcrumbDims.height);
      points.push('0,' + breadcrumbDims.height);
      if (i > 0) { // Leftmost breadcrumb; don't include 6th vertex.
        points.push(breadcrumbDims.tipTailWidth + ',' + (breadcrumbDims.height / 2));
      }
      return points.join(' ');
    }

    function updateBreadcrumbs(sequenceArray, percentageString) {
      const g = breadcrumbs.selectAll('g')
        .data(sequenceArray, function (d) {
          return d.name + d.depth;
        });

      // Add breadcrumb and label for entering nodes.
      const entering = g.enter().append('svg:g');

      entering.append('svg:polygon')
          .attr('points', breadcrumbPoints)
          .style('fill', function (d) {
            return colorByCategory ? category21(d.name) : colorScale(d.m2 / d.m1);
          });

      entering.append('svg:text')
          .attr('x', (breadcrumbDims.width + breadcrumbDims.tipTailWidth) / 2)
          .attr('y', breadcrumbDims.height / 4)
          .attr('dy', '0.35em')
          .style('fill', function (d) {
            // Make text white or black based on the lightness of the background
            const col = d3.hsl(colorByCategory ? category21(d.name) : colorScale(d.m2 / d.m1));
            return col.l < 0.5 ? 'white' : 'black';
          })
          .attr('class', 'step-label')
          .text(function (d) { return d.name.replace(/_/g, ' '); })
          .call(wrapSvgText, breadcrumbDims.width, breadcrumbDims.height / 2);

      // Set position for entering and updating nodes.
      g.attr('transform', function (d, i) {
        return 'translate(' + i * (breadcrumbDims.width + breadcrumbDims.spacing) + ', 0)';
      });

      // Remove exiting nodes.
      g.exit().remove();

      // Now move and update the percentage at the end.
      breadcrumbs.select('.end-label')
          .attr('x', (sequenceArray.length + 0.5) * (breadcrumbDims.width + breadcrumbDims.spacing))
          .attr('y', breadcrumbDims.height / 2)
          .attr('dy', '0.35em')
          .text(percentageString);

      // Make the breadcrumb trail visible, if it's hidden.
      breadcrumbs.style('visibility', null);
    }

    // Fade all but the current sequence, and show it in the breadcrumb trail.
    function mouseenter(d) {
      const sequenceArray = getAncestors(d);
      const parentOfD = sequenceArray[sequenceArray.length - 2] || null;

      const absolutePercentage = (d.m1 / totalSize).toPrecision(3);
      const conditionalPercentage = parentOfD ? (d.m1 / parentOfD.m1).toPrecision(3) : null;

      const absolutePercString = formatPerc(absolutePercentage);
      const conditionalPercString = parentOfD ? formatPerc(conditionalPercentage) : '';

      // 3 levels of text if inner-most level, 4 otherwise
      const yOffsets = ['-25', '7', '35', '60'];
      let offsetIndex = 0;

      // If metrics match, assume we are coloring by category
      const metricsMatch = Math.abs(d.m1 - d.m2) < 0.00001;

      gMiddleText.selectAll('*').remove();

      gMiddleText.append('text')
        .attr('class', 'path-abs-percent')
        .attr('y', yOffsets[offsetIndex++])
        .text(absolutePercString + ' of total');

      if (conditionalPercString) {
        gMiddleText.append('text')
          .attr('class', 'path-cond-percent')
          .attr('y', yOffsets[offsetIndex++])
          .text(conditionalPercString + ' of parent');
      }

      gMiddleText.append('text')
        .attr('class', 'path-metrics')
        .attr('y', yOffsets[offsetIndex++])
        .text('m1: ' + formatNum(d.m1) + (metricsMatch ? '' : ', m2: ' + formatNum(d.m2)));

      gMiddleText.append('text')
        .attr('class', 'path-ratio')
        .attr('y', yOffsets[offsetIndex++])
        .text((metricsMatch ? '' : ('m2/m1: ' + formatPerc(d.m2 / d.m1))));

      // Reset and fade all the segments.
      arcs.selectAll('path')
        .style('stroke-width', null)
        .style('stroke', null)
        .style('opacity', 0.7);

      // Then highlight only those that are an ancestor of the current segment.
      arcs.selectAll('path')
        .filter(function (node) {
          return (sequenceArray.indexOf(node) >= 0);
        })
        .style('opacity', 1)
        .style('stroke-width', '2px')
        .style('stroke', '#000');

      updateBreadcrumbs(sequenceArray, absolutePercString);
    }

    // Restore everything to full opacity when moving off the visualization.
    function mouseleave() {
      // Hide the breadcrumb trail
      breadcrumbs.style('visibility', 'hidden');

      gMiddleText.selectAll('*').remove();

      // Deactivate all segments during transition.
      arcs.selectAll('path').on('mouseenter', null);

      // Transition each segment to full opacity and then reactivate it.
      arcs.selectAll('path')
        .transition()
        .duration(200)
        .style('opacity', 1)
        .style('stroke', null)
        .style('stroke-width', null)
        .each('end', function () {
          d3.select(this).on('mouseenter', mouseenter);
        });
    }


    function buildHierarchy(rows) {
      const root = {
        name: 'root',
        children: [],
      };

      // each record [groupby1val, groupby2val, (<string> or 0)n, m1, m2]
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const m1 = Number(row[row.length - 2]);
        const m2 = Number(row[row.length - 1]);
        const levels = row.slice(0, row.length - 2);
        if (isNaN(m1)) { // e.g. if this is a header row
          continue;
        }
        let currentNode = root;
        for (let level = 0; level < levels.length; level++) {
          const children = currentNode.children || [];
          const nodeName = levels[level];
          // If the next node has the name '0', it will
          const isLeafNode = (level >= levels.length - 1) || levels[level + 1] === 0;
          let childNode;
          let currChild;

          if (!isLeafNode) {
            // Not yet at the end of the sequence; move down the tree.
            let foundChild = false;
            for (let k = 0; k < children.length; k++) {
              currChild = children[k];
              if (currChild.name === nodeName &&
                  currChild.level === level) {
 // must match name AND level

                childNode = currChild;
                foundChild = true;
                break;
              }
            }
            // If we don't already have a child node for this branch, create it.
            if (!foundChild) {
              childNode = {
                name: nodeName,
                children: [],
                level,
              };
              children.push(childNode);
            }
            currentNode = childNode;
          } else if (nodeName !== 0) {
            // Reached the end of the sequence; create a leaf node.
            childNode = {
              name: nodeName,
              m1,
              m2,
            };
            children.push(childNode);
          }
        }
      }

      function recurse(node) {
        if (node.children) {
          let sums;
          let m1 = 0;
          let m2 = 0;
          for (let i = 0; i < node.children.length; i++) {
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

    // Main function to draw and set up the visualization, once we have the data.
    function createVisualization(rawData) {
      const tree = buildHierarchy(rawData.data);

      vis = svg.append('svg:g')
        .attr('class', 'sunburst-vis')
        .attr('transform', (
          'translate(' +
            `${(margin.left + (visWidth / 2))},` +
            `${(margin.top + breadcrumbHeight + (visHeight / 2))}` +
          ')'
        ))
        .on('mouseleave', mouseleave);

      arcs = vis.append('svg:g')
        .attr('id', 'arcs');

      gMiddleText = vis.append('svg:g')
        .attr('class', 'center-label');

      // Bounding circle underneath the sunburst, to make it easier to detect
      // when the mouse leaves the parent g.
      arcs.append('svg:circle')
        .attr('r', radius)
        .style('opacity', 0);

      // For efficiency, filter nodes to keep only those large enough to see.
      const nodes = partition.nodes(tree)
        .filter(function (d) {
          return (d.dx > 0.005); // 0.005 radians = 0.29 degrees
        });

      let ext;

      if (rawData.form_data.metric !== rawData.form_data.secondary_metric) {
        colorByCategory = false;
        ext = d3.extent(nodes, (d) => d.m2 / d.m1);
        colorScale = d3.scale.linear()
          .domain([ext[0], ext[0] + ((ext[1] - ext[0]) / 2), ext[1]])
          .range(['#00D1C1', 'white', '#FFB400']);
      }

      const path = arcs.data([tree]).selectAll('path')
        .data(nodes)
        .enter()
        .append('svg:path')
        .attr('display', function (d) {
          return d.depth ? null : 'none';
        })
        .attr('d', arc)
        .attr('fill-rule', 'evenodd')
        .style('fill', (d) => colorByCategory ? category21(d.name) : colorScale(d.m2 / d.m1))
        .style('opacity', 1)
        .on('mouseenter', mouseenter);

      // Get total size of the tree = value of root node from partition.
      totalSize = path.node().__data__.value;
    }


    d3.json(slice.jsonEndpoint(), function (error, rawData) {
      if (error !== null) {
        slice.error(error.responseText, error);
        return;
      }
      createBreadcrumbs(rawData);
      createVisualization(rawData);
      slice.done(rawData);
    });
  };

  return {
    render,
    resize: render,
  };
}

module.exports = sunburstVis;
