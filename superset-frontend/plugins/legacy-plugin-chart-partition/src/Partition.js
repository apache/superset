/* eslint-disable react/sort-prop-types */
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
/* eslint no-param-reassign: [2, {"props": false}] */
import d3 from 'd3';
import PropTypes from 'prop-types';
import { hierarchy } from 'd3-hierarchy';
import {
  getNumberFormatter,
  getTimeFormatter,
  CategoricalColorNamespace,
} from '@superset-ui/core';

// Compute dx, dy, x, y for each node and
// return an array of nodes in breadth-first order
function init(root) {
  let flat = [];
  let dy = 1 / (root.height + 1);
  let prev = null;
  root.each(n => {
    n.y = dy * n.depth;
    n.dy = dy;
    if (n.parent) {
      if (prev.parent == n.parent) {
        n.x = prev.x + prev.dx;
      } else {
        n.x = prev.depth === n.parent.depth ? 0 : n.parent.x;
      }
      n.dx = (n.weight / n.parent.sum) * n.parent.dx;
    } else {
      n.x = 0;
      n.dx = 1;
    }
    prev = n;
    flat.push(n);
  });

  return flat;
}

// Declare PropTypes for recursive data structures
// https://github.com/facebook/react/issues/5676
/* eslint-disable-next-line  no-undef */
const lazyFunction = f => () => f().apply(this, arguments);
const leafType = PropTypes.shape({
  name: PropTypes.string,
  val: PropTypes.number.isRequired,
});
const parentShape = {
  name: PropTypes.string,
  val: PropTypes.number.isRequired,
  children: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.shape(lazyFunction(() => parentShape)),
      leafType,
    ]),
  ),
};
const nodeType = PropTypes.oneOfType([PropTypes.shape(parentShape), leafType]);

const propTypes = {
  data: PropTypes.arrayOf(nodeType), // array of rootNode
  width: PropTypes.number,
  height: PropTypes.number,
  colorScheme: PropTypes.string,
  dateTimeFormat: PropTypes.string,
  equalDateSize: PropTypes.bool,
  levels: PropTypes.arrayOf(PropTypes.string),
  metrics: PropTypes.arrayOf(
    PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  ),
  numberFormat: PropTypes.string,
  partitionLimit: PropTypes.number,
  partitionThreshold: PropTypes.number,
  timeSeriesOption: PropTypes.string,
  useLogScale: PropTypes.bool,
  useRichTooltip: PropTypes.bool,
};

function getAncestors(d) {
  let ancestors = [d];
  let node = d;
  while (node.parent) {
    ancestors.push(node.parent);
    node = node.parent;
  }

  return ancestors;
}

// This vis is based on
// http://mbostock.github.io/d3/talk/20111018/partition.html
function Icicle(element, props) {
  const {
    width,
    height,
    data,
    colorScheme,
    dateTimeFormat,
    equalDateSize,
    levels,
    useLogScale = false,
    metrics = [],
    numberFormat,
    partitionLimit,
    partitionThreshold,
    useRichTooltip,
    timeSeriesOption = 'not_time',
    sliceId,
  } = props;

  const div = d3.select(element);
  div.classed('superset-legacy-chart-partition', true);

  // Chart options
  const chartType = timeSeriesOption;
  const hasTime = ['adv_anal', 'time_series'].includes(chartType);
  const format = getNumberFormatter(numberFormat);
  const timeFormat = getTimeFormatter(dateTimeFormat);
  const colorFn = CategoricalColorNamespace.getScale(colorScheme);

  div.selectAll('*').remove();
  const tooltip = div.append('div').classed('partition-tooltip', true);

  function hasDateNode(n) {
    return metrics.includes(n.data.name) && hasTime;
  }

  function getCategory(depth) {
    if (!depth) {
      return 'Metric';
    }
    if (hasTime && depth === 1) {
      return 'Date';
    }

    return levels[depth - (hasTime ? 2 : 1)];
  }

  function addOtherNode(parent, weight) {
    let otherNodeSrc = {
      name: Array.isArray(parent.name) ? parent.name.concat(['<other>']) : [parent.name, '<other>'],
      children: []
    };
    let otherNode = hierarchy(otherNodeSrc);
    otherNode.parent = parent;
    otherNode.name = otherNode.data.name;
    otherNode.disp = weight;
    otherNode.depth = parent.depth + 1;
    otherNode.value = weight;
    otherNode.weight = weight;
    parent.children.push(otherNode);
  }

  function prepareData(datum) {
    let tree = hierarchy(datum);

    // node.name is the metric/group name
    // node.disp is the display value
    // node.value determines sorting order
    // node.weight determines partition height
    // node.sum is the sum of children weights
    tree.eachAfter(n => {
      n.disp = n.data.val;
      n.value = n.disp < 0 ? -n.disp : n.disp;
      n.weight = n.value;
      n.name = n.data.name;
      // If the parent is a metric and we still have
      // the time column, perform a date-time format
      if (n.parent && hasDateNode(n.parent)) {
        // Format timestamp values
        n.weight = equalDateSize ? 1 : n.value;
        n.value = n.name;
        n.name = timeFormat(n.name);
      }
      if (useLogScale) n.weight = Math.log(n.weight + 1);
      n.disp =
        n.disp && !Number.isNaN(n.disp) && Number.isFinite(n.disp)
          ? format(n.disp)
          : '';
    });

    // Perform sort by weight
    tree.sort((a, b) => {
      if (b.parent.weight === a.parent.weight) {
        let v = b.weight - a.weight;
        if (v === 0) {
          return b.weight > a.weight ? 1 : -1;
        }
        return v;
      } else {
        let pv = b.parent.weight - a.parent.weight;
          if (pv === 0) {
            return b.parent.weight > a.parent.weight ? 1 : -1;
          }
        return pv;
      }
    });

    // Prune data based on partition threshold
    if (partitionThreshold && partitionThreshold >= 0) {
      // Compute weight sums as we go
      tree.eachAfter(n => {
        // Collect weigts of removed nodes
        let sumRemoved = 0;
        n.sum = n.children
          ? n.children.reduce((a, v) => a + v.weight, 0) || 1
          : 1;
        if (n.children) {
          // Dates are not ordered by weight
          if (hasDateNode(n)) {
            if (equalDateSize) {
              return;
            }
            let removeIndices = [];
            // Keep at least one child
            for (let j = 1; j < n.children.length; j += 1) {
              if (n.children[j].weight / n.sum < partitionThreshold) {
                sumRemoved += n.children[j].weight;
                removeIndices.push(j);
              }
            }
            let removed = [];
            for (let j = removeIndices.length - 1; j >= 0; j -= 1) {
              n.children.splice(removeIndices[j], 1);
            }
          } else {
            // Find first child that falls below the threshold
            let j;
            n.sum = n.children ? n.children.reduce((a, v) => a + v.weight, 0) || 1 : 1;
            sumRemoved = n.sum - n.children[0].weight; // First is never dropped
            for (j = 1; j < n.children.length; j += 1) {
              if (n.children[j].weight / n.sum < partitionThreshold) {
                break;
              }
              sumRemoved -= n.children[j].weight;
            }
            n.children = n.children.slice(0, j);
          }
          if (sumRemoved > 0) {
            addOtherNode(n, sumRemoved);
          }
      }
      });
    }

    // Prune data based on partition limit
    if (partitionLimit && partitionLimit >= 0) {
      tree.eachAfter(n => {
        // Collect weigts of removed nodes
        if (n.children && n.children.length > partitionLimit) {
          if (!hasDateNode(n)) {
            let prevSum = n.children ? n.children.reduce((a, v) => a + v.weight, 0) || 1 : 1;
            n.children = n.children.slice(0, partitionLimit);
            let sumRemoved = prevSum - n.children.reduce((a, v) => a + v.weight, 0);;
            if (sumRemoved > 0) {
              addOtherNode(n, sumRemoved);
            }
          }
        }
        n.sum = n.children
        ? n.children.reduce((a, v) => a + v.weight, 0) || 1
        : 1;
      });
    }

    // Compute final weight sums
    tree.eachAfter(n => {
      n.sum = n.children
        ? n.children.reduce((a, v) => a + v.weight, 0) || 1
        : 1;
    });

    tree.eachAfter(n => {
      if (useLogScale) n.weight = Math.log(n.weight + 1);
    });

    return tree;
  }

  function drawVis(i, dat) {
    const datum = dat[i];
    let root = prepareData(datum)

    let w = width;
    let h = height / data.length;
    let x = d3.scale.linear().range([0, w]);
    let y = d3.scale.linear().range([0, h]);

    let viz = div
      .append('div')
      .attr('class', 'chart')
      .style('width', `${w}px`)
      .style('height', `${h}px`)
      .append('svg:svg')
      .attr('width', w)
      .attr('height', h);

    // Add padding between multiple visualizations
    if (i !== data.length - 1 && data.length > 1) {
      viz.style('padding-bottom', '3px');
    }
    if (i !== 0 && data.length > 1) {
      viz.style('padding-top', '3px');
    }

    function positionAndPopulate(tip, d) {
      let t = '<table>';
      if (useRichTooltip) {
        let nodes = getAncestors(d);
        nodes.reverse().forEach(n => {
          t += '<tbody>';
          t +=
            '<tr>' +
            '<td>' +
            '<div ' +
            `style='border: 2px solid transparent;` +
            `background-color: ${n.color};'` +
            '></div>' +
            '</td>' +
            `<td>${getCategory(n.depth)}</td>` +
            `<td>${n.name}</td>` +
            `<td>${n.disp}</td>` +
            '</tr>';
        });
      } else {
        t +=
          '<thead><tr><td colspan="3">' +
          `<strong>${getCategory(d.depth)}</strong>` +
          '</td></tr></thead><tbody>';
        t +=
          '<tr>' +
          '<td>' +
          `<div style='border: thin solid grey; background-color: ${d.color};'` +
          '></div>' +
          '</td>' +
          `<td>${d.name}</td>` +
          `<td>${d.disp}</td>` +
          '</tr>';
      }
      t += '</tbody></table>';
      let [tipX, tipY] = d3.mouse(element);
      tip
        .html(t)
        .style('left', `${tipX + 15}px`)
        .style('top', `${tipY}px`);
    }

    let nodes = init(root);

    let zoomX = w / root.dx;
    let zoomY = h / 1;

    // Keep text centered in its division
    function transform(d) {
      return `translate(8,${(d.dx * zoomY) / 2})`;
    }

    let g = viz
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('svg:g')
      .attr('transform', d => `translate(${x(d.y)},${y(d.x)})`)
      .on('mouseover', d => {
        tooltip.interrupt().transition().duration(100).style('opacity', 0.9);
        positionAndPopulate(tooltip, d);
      })
      .on('mousemove', d => {
        positionAndPopulate(tooltip, d);
      })
      .on('mouseout', () => {
        tooltip.interrupt().transition().duration(250).style('opacity', 0);
      });

    // When clicking a subdivision, the vis will zoom in to it
    function click(d) {
      if (!d.children) {
        if (d.parent) {
          // Clicking on the rightmost level should zoom in
          return click(d.parent);
        }

        return false;
      }
      zoomX = (d.y ? w - 40 : w) / (1 - d.y);
      zoomY = h / d.dx;
      x.domain([d.y, 1]).range([d.y ? 40 : 0, w]);
      y.domain([d.x, d.x + d.dx]);

      let t = g
        .transition()
        .duration(d3.event.altKey ? 7500 : 750)
        .attr('transform', nd => `translate(${x(nd.y)},${y(nd.x)})`);

      t.select('rect')
        .attr('width', d.dy * zoomX)
        .attr('height', nd => nd.dx * zoomY);

      t.select('text')
        .attr('transform', transform)
        .style('opacity', nd => (nd.dx * zoomY > 12 ? 1 : 0));

      d3.event.stopPropagation();

      return true;
    }

    g.on('click', click);

    g.append('svg:rect')
      .attr('width', root.dy * zoomX)
      .attr('height', d => d.dx * zoomY);

    g.append('svg:text')
      .attr('transform', transform)
      .attr('dy', '0.35em')
      .style('opacity', d => (d.dx * zoomY > 12 ? 1 : 0))
      .text(d => {
        if (!d.disp) {
          return d.name;
        }

        return `${d.name}: ${d.disp}`;
      });

    // Apply color scheme
    g.selectAll('rect').style('fill', d => {
      d.color = colorFn(d.name, sliceId);

      return d.color;
    });
  }

  for (let i = 0; i < data.length; i += 1) {
    drawVis(i, data);
  }
}

Icicle.displayName = 'Icicle';
Icicle.propTypes = propTypes;

export default Icicle;
