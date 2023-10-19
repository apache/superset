/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
/* eslint-disable no-param-reassign, react/sort-prop-types */
import d3 from 'd3';
import PropTypes from 'prop-types';
import {
  getNumberFormatter,
  NumberFormats,
  CategoricalColorNamespace,
  getSequentialSchemeRegistry,
  t,
} from '@superset-ui/core';
import wrapSvgText from './utils/wrapSvgText';

const propTypes = {
  // Each row is an array of [hierarchy-lvl1, hierarchy-lvl2, metric1, metric2]
  // hierarchy-lvls are string. metrics are number
  data: PropTypes.arrayOf(PropTypes.array),
  width: PropTypes.number,
  height: PropTypes.number,
  colorScheme: PropTypes.string,
  linearColorScheme: PropTypes.string,
  numberFormat: PropTypes.string,
  metrics: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.object, // The metric object
    ]),
  ),
};

function metricLabel(metric) {
  return typeof metric === 'string' || metric instanceof String
    ? metric
    : metric.label;
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

function buildHierarchy(rows) {
  const root = {
    name: 'root',
    children: [],
  };

  // each record [groupby1val, groupby2val, (<string> or 0)n, m1, m2]
  rows.forEach(row => {
    const m1 = Number(row[row.length - 2]);
    const m2 = Number(row[row.length - 1]);
    const levels = row.slice(0, -2);
    if (Number.isNaN(m1)) {
      // e.g. if this is a header row
      return;
    }
    let currentNode = root;
    for (let level = 0; level < levels.length; level += 1) {
      const children = currentNode.children || [];
      const node = levels[level];
      const nodeName = node ? node.toString() : t('N/A');
      // If the next node has the name '0', it will
      const isLeafNode = level >= levels.length - 1 || levels[level + 1] === 0;
      let childNode;

      if (!isLeafNode) {
        childNode = children.find(
          child => child.name === nodeName && child.level === level,
        );

        if (!childNode) {
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
  });

  function recurse(node) {
    if (node.children) {
      let sums;
      let m1 = 0;
      let m2 = 0;
      for (let i = 0; i < node.children.length; i += 1) {
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

function getResponsiveContainerClass(width) {
  if (width > 500) {
    return 'l';
  }

  if (width > 200 && width <= 500) {
    return 'm';
  }

  return 's';
}

function getYOffset(width) {
  if (width > 500) {
    return ['0', '20', '40', '60'];
  }

  if (width > 200 && width <= 500) {
    return ['0', '15', '30', '45'];
  }

  return ['0', '10', '20', '30'];
}

// Modified from http://bl.ocks.org/kerryrodden/7090426
function Sunburst(element, props) {
  const container = d3.select(element);
  const {
    data,
    width,
    height,
    colorScheme,
    linearColorScheme,
    metrics,
    numberFormat,
    sliceId,
  } = props;
  const responsiveClass = getResponsiveContainerClass(width);
  const isSmallWidth = responsiveClass === 's';
  container.attr('class', `superset-legacy-chart-sunburst ${responsiveClass}`);
  // vars with shared scope within this function
  const margin = { top: 10, right: 5, bottom: 10, left: 5 };
  const containerWidth = width;
  const containerHeight = height;
  const breadcrumbHeight = containerHeight * 0.085;
  const visWidth = containerWidth - margin.left - margin.right;
  const visHeight =
    containerHeight - margin.top - margin.bottom - breadcrumbHeight;
  const radius = Math.min(visWidth, visHeight) / 2;

  let colorByCategory = true; // color by category if primary/secondary metrics match
  let maxBreadcrumbs;
  let breadcrumbDims; // set based on data
  let totalSize; // total size of all segments; set after loading the data.
  let breadcrumbs;
  let vis;
  let arcs;
  let gMiddleText; // dom handles

  const categoricalColorScale = CategoricalColorNamespace.getScale(colorScheme);
  let linearColorScale;

  // Helper + path gen functions
  const partition = d3.layout
    .partition()
    .size([2 * Math.PI, radius * radius])
    .value(d => d.m1);

  const arc = d3.svg
    .arc()
    .startAngle(d => d.x)
    .endAngle(d => d.x + d.dx)
    .innerRadius(d => Math.sqrt(d.y))
    .outerRadius(d => Math.sqrt(d.y + d.dy));

  const formatNum = getNumberFormatter(
    numberFormat || NumberFormats.SI_3_DIGIT,
  );
  const formatPerc = getNumberFormatter(NumberFormats.PERCENT_3_POINT);

  container.select('svg').remove();

  const svg = container
    .append('svg:svg')
    .attr('width', containerWidth)
    .attr('height', containerHeight);

  function createBreadcrumbs(firstRowData) {
    // -2 bc row contains 2x metrics, +extra for %label and buffer
    maxBreadcrumbs = firstRowData.length - 2 + 1;
    breadcrumbDims = {
      width: visWidth / maxBreadcrumbs,
      height: breadcrumbHeight * 0.8, // more margin
      spacing: 3,
      tipTailWidth: 10,
    };

    breadcrumbs = svg
      .append('svg:g')
      .attr('class', 'breadcrumbs')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    breadcrumbs.append('svg:text').attr('class', 'end-label');
  }

  // Generate a string that describes the points of a breadcrumb polygon.
  function breadcrumbPoints(d, i) {
    const points = [];
    if (isSmallWidth) {
      points.push('0,0');
      points.push(`${width},0`);
      points.push(`${width},0`);
      points.push(`${width},${breadcrumbDims.height}`);
      points.push(`0,${breadcrumbDims.height}`);
      if (i > 0) {
        // Leftmost breadcrumb; don't include 6th vertex.
        // points.push(`${breadcrumbDims.tipTailWidth},${breadcrumbDims.height / 2}`);
      }
    } else {
      points.push('0,0');
      points.push(`${breadcrumbDims.width},0`);
      points.push(
        `${breadcrumbDims.width + breadcrumbDims.tipTailWidth},${
          breadcrumbDims.height / 2
        }`,
      );
      points.push(`${breadcrumbDims.width},${breadcrumbDims.height}`);
      points.push(`0,${breadcrumbDims.height}`);
      if (i > 0) {
        // Leftmost breadcrumb; don't include 6th vertex.
        points.push(
          `${breadcrumbDims.tipTailWidth},${breadcrumbDims.height / 2}`,
        );
      }
    }

    return points.join(' ');
  }

  function updateBreadcrumbs(sequenceArray, percentageString) {
    const breadcrumbWidth = isSmallWidth ? width : breadcrumbDims.width;
    const g = breadcrumbs
      .selectAll('g')
      .data(sequenceArray, d => d.name + d.depth);

    // Add breadcrumb and label for entering nodes.
    const entering = g.enter().append('svg:g');

    entering
      .append('svg:polygon')
      .attr('points', breadcrumbPoints)
      .style('fill', d =>
        colorByCategory
          ? categoricalColorScale(d.name, sliceId)
          : linearColorScale(d.m2 / d.m1),
      );

    entering
      .append('svg:text')
      .attr('x', (breadcrumbWidth + breadcrumbDims.tipTailWidth) / 2)
      .attr('y', breadcrumbDims.height / 4)
      .attr('dy', '0.35em')
      .style('fill', d => {
        // Make text white or black based on the lightness of the background
        const col = d3.hsl(
          colorByCategory
            ? categoricalColorScale(d.name, sliceId)
            : linearColorScale(d.m2 / d.m1),
        );

        return col.l < 0.5 ? 'white' : 'black';
      })
      .attr('class', 'step-label')
      .text(d => d.name.replace(/_/g, ' '))
      .call(wrapSvgText, breadcrumbWidth, breadcrumbDims.height / 2);

    // Set position for entering and updating nodes.
    g.attr('transform', (d, i) => {
      if (isSmallWidth) {
        return `translate(0, ${
          i * (breadcrumbDims.height + breadcrumbDims.spacing)
        })`;
      }
      return `translate(${
        i * (breadcrumbDims.width + breadcrumbDims.spacing)
      }, 0)`;
    });

    // Remove exiting nodes.
    g.exit().remove();

    // Now move and update the percentage at the end.
    breadcrumbs
      .select('.end-label')
      .attr('x', () => {
        if (isSmallWidth) {
          return (breadcrumbWidth + breadcrumbDims.tipTailWidth) / 2;
        }

        return (
          (sequenceArray.length + 0.5) *
          (breadcrumbDims.width + breadcrumbDims.spacing)
        );
      })
      .attr('y', () => {
        if (isSmallWidth) {
          return (sequenceArray.length + 1) * breadcrumbDims.height;
        }

        return breadcrumbDims.height / 2;
      })
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
    const conditionalPercentage = parentOfD
      ? (d.m1 / parentOfD.m1).toPrecision(3)
      : null;

    const absolutePercString = formatPerc(absolutePercentage);
    const conditionalPercString = parentOfD
      ? formatPerc(conditionalPercentage)
      : '';

    // 3 levels of text if inner-most level, 4 otherwise
    const yOffsets = getYOffset(width);
    let offsetIndex = 0;

    // If metrics match, assume we are coloring by category
    const metricsMatch = Math.abs(d.m1 - d.m2) < 0.00001;

    gMiddleText.selectAll('*').remove();

    offsetIndex += 1;
    gMiddleText
      .append('text')
      .attr('class', 'path-abs-percent')
      .attr('y', yOffsets[offsetIndex])
      // eslint-disable-next-line prefer-template
      .text(absolutePercString + ' ' + t('of total'));

    const OF_PARENT_TEXT = t('of parent');

    if (conditionalPercString) {
      offsetIndex += 1;
      gMiddleText
        .append('text')
        .attr('class', 'path-cond-percent')
        .attr('y', yOffsets[offsetIndex])
        .text(`${conditionalPercString} ${OF_PARENT_TEXT}`);
    }

    offsetIndex += 1;
    gMiddleText
      .append('text')
      .attr('class', 'path-metrics')
      .attr('y', yOffsets[offsetIndex])
      .text(
        `${metricLabel(metrics[0])}: ${formatNum(d.m1)}${
          metricsMatch ? '' : `, ${metricLabel(metrics[1])}: ${formatNum(d.m2)}`
        }`,
      );

    offsetIndex += 1;
    gMiddleText
      .append('text')
      .attr('class', 'path-ratio')
      .attr('y', yOffsets[offsetIndex])
      .text(
        metricsMatch
          ? ''
          : `${metricLabel(metrics[1])}/${metricLabel(
              metrics[0],
            )}: ${formatPerc(d.m2 / d.m1)}`,
      );

    // Reset and fade all the segments.
    arcs
      .selectAll('path')
      .style('stroke-width', null)
      .style('stroke', null)
      .style('opacity', 0.3);

    // Then highlight only those that are an ancestor of the current segment.
    arcs
      .selectAll('path')
      .filter(node => sequenceArray.includes(node))
      .style('opacity', 1)
      .style('stroke', '#aaa');

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
    arcs
      .selectAll('path')
      .transition()
      .duration(200)
      .style('opacity', 1)
      .style('stroke', null)
      .style('stroke-width', null)
      .each('end', function end() {
        d3.select(this).on('mouseenter', mouseenter);
      });
  }

  // Main function to draw and set up the visualization, once we have the data.
  function createVisualization(rows) {
    const root = buildHierarchy(rows);
    maxBreadcrumbs = rows[0].length - 2;
    vis = svg
      .append('svg:g')
      .attr('class', 'sunburst-vis')
      .attr(
        'transform',
        'translate(' +
          `${margin.left + visWidth / 2},` +
          `${
            margin.top +
            (isSmallWidth
              ? breadcrumbHeight * maxBreadcrumbs
              : breadcrumbHeight) +
            visHeight / 2
          }` +
          ')',
      )
      .on('mouseleave', mouseleave);

    arcs = vis.append('svg:g').attr('id', 'arcs');

    gMiddleText = vis.append('svg:g').attr('class', 'center-label');

    // Bounding circle underneath the sunburst, to make it easier to detect
    // when the mouse leaves the parent g.
    arcs.append('svg:circle').attr('r', radius).style('opacity', 0);

    // For efficiency, filter nodes to keep only those large enough to see.
    const nodes = partition.nodes(root).filter(d => d.dx > 0.005); // 0.005 radians = 0.29 degrees

    if (metrics[0] !== metrics[1] && metrics[1]) {
      colorByCategory = false;
      const ext = d3.extent(nodes, d => d.m2 / d.m1);
      linearColorScale = getSequentialSchemeRegistry()
        .get(linearColorScheme)
        .createLinearScale(ext);
    }

    arcs
      .selectAll('path')
      .data(nodes)
      .enter()
      .append('svg:path')
      .attr('display', d => (d.depth ? null : 'none'))
      .attr('d', arc)
      .attr('fill-rule', 'evenodd')
      .style('fill', d =>
        colorByCategory
          ? categoricalColorScale(d.name, sliceId)
          : linearColorScale(d.m2 / d.m1),
      )
      .style('opacity', 1)
      .on('mouseenter', mouseenter);

    // Get total size of the tree = value of root node from partition.
    totalSize = root.value;
  }
  createBreadcrumbs(data[0]);
  createVisualization(data);
}

Sunburst.displayName = 'Sunburst';
Sunburst.propTypes = propTypes;

export default Sunburst;
