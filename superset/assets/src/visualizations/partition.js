/* eslint no-param-reassign: [2, {"props": false}] */
/* eslint no-use-before-define: ["error", { "functions": false }] */
import d3 from 'd3';
import {
  d3TimeFormatPreset,
} from '../modules/utils';
import { getColorFromScheme } from '../modules/colors';

import './partition.css';

d3.hierarchy = require('d3-hierarchy').hierarchy;
d3.partition = require('d3-hierarchy').partition;

function init(root) {
  // Compute dx, dy, x, y for each node and
  // return an array of nodes in breadth-first order
  const flat = [];
  const dy = 1.0 / (root.height + 1);
  let prev = null;
  root.each((n) => {
    n.y = dy * n.depth;
    n.dy = dy;
    if (!n.parent) {
      n.x = 0;
      n.dx = 1;
    } else {
      n.x = prev.depth === n.parent.depth ? 0 : prev.x + prev.dx;
      n.dx = n.weight / n.parent.sum * n.parent.dx;
    }
    prev = n;
    flat.push(n);
  });
  return flat;
}

// This vis is based on
// http://mbostock.github.io/d3/talk/20111018/partition.html
function partitionVis(slice, payload) {
  const data = payload.data;
  const fd = slice.formData;
  const div = d3.select(slice.selector);
  const metrics = fd.metrics || [];

  // Chart options
  const logScale = fd.log_scale || false;
  const chartType = fd.time_series_option || 'not_time';
  const hasTime = ['adv_anal', 'time_series'].indexOf(chartType) >= 0;
  const format = d3.format(fd.number_format);
  const timeFormat = d3TimeFormatPreset(fd.date_time_format);

  div.selectAll('*').remove();
  d3.selectAll('.nvtooltip').remove();
  const tooltip = d3
    .select('body')
    .append('div')
    .attr('class', 'nvtooltip')
    .style('opacity', 0)
    .style('top', 0)
    .style('left', 0)
    .style('position', 'fixed');

  function drawVis(i, dat) {
    const datum = dat[i];
    const w = slice.width();
    const h = slice.height() / data.length;
    const x = d3.scale.linear().range([0, w]);
    const y = d3.scale.linear().range([0, h]);

    const viz = div
      .append('div')
      .attr('class', 'chart')
      .style('width', w + 'px')
      .style('height', h + 'px')
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

    const root = d3.hierarchy(datum);

    function hasDateNode(n) {
      return metrics.indexOf(n.data.name) >= 0 && hasTime;
    }

    // node.name is the metric/group name
    // node.disp is the display value
    // node.value determines sorting order
    // node.weight determines partition height
    // node.sum is the sum of children weights
    root.eachAfter((n) => {
      n.disp = n.data.val;
      n.value = n.disp < 0 ? -n.disp : n.disp;
      n.weight = n.value;
      n.name = n.data.name;
      // If the parent is a metric and we still have
      // the time column, perform a date-time format
      if (n.parent && hasDateNode(n.parent)) {
        // Format timestamp values
        n.weight = fd.equal_date_size ? 1 : n.value;
        n.value = n.name;
        n.name = timeFormat(n.name);
      }
      if (logScale) n.weight = Math.log(n.weight + 1);
      n.disp = n.disp && !isNaN(n.disp) && isFinite(n.disp) ? format(n.disp) : '';
    });
    // Perform sort by weight
    root.sort((a, b) => {
      const v = b.value - a.value;
      if (v === 0) {
        return b.name > a.name ? 1 : -1;
      }
      return v;
    });

    // Prune data based on partition limit and threshold
    // both are applied at the same time
    if (fd.partition_threshold && fd.partition_threshold >= 0) {
      // Compute weight sums as we go
      root.each((n) => {
        n.sum = n.children ? n.children.reduce((a, v) => a + v.weight, 0) || 1 : 1;
        if (n.children) {
          // Dates are not ordered by weight
          if (hasDateNode(n)) {
            if (fd.equal_date_size) {
              return;
            }
            const removeIndices = [];
            // Keep at least one child
            for (let j = 1; j < n.children.length; j++) {
              if (n.children[j].weight / n.sum < fd.partition_threshold) {
                removeIndices.push(j);
              }
            }
            for (let j = removeIndices.length - 1; j >= 0; j--) {
              n.children.splice(removeIndices[j], 1);
            }
          } else {
            // Find first child that falls below the threshold
            let j;
            for (j = 1; j < n.children.length; j++) {
              if (n.children[j].weight / n.sum < fd.partition_threshold) {
                break;
              }
            }
            n.children = n.children.slice(0, j);
          }
        }
      });
    }
    if (fd.partition_limit && fd.partition_limit >= 0) {
      root.each((n) => {
        if (n.children && n.children.length > fd.partition_limit) {
          if (!hasDateNode(n)) {
            n.children = n.children.slice(0, fd.partition_limit);
          }
        }
      });
    }
    // Compute final weight sums
    root.eachAfter((n) => {
      n.sum = n.children ? n.children.reduce((a, v) => a + v.weight, 0) || 1 : 1;
    });

    const verboseMap = slice.datasource.verbose_map;
    function getCategory(depth) {
      if (!depth) {
        return 'Metric';
      }
      if (hasTime && depth === 1) {
        return 'Date';
      }
      const col = fd.groupby[depth - (hasTime ? 2 : 1)];
      return verboseMap[col] || col;
    }

    function getAncestors(d) {
      const ancestors = [d];
      let node = d;
      while (node.parent) {
        ancestors.push(node.parent);
        node = node.parent;
      }
      return ancestors;
    }

    function positionAndPopulate(tip, d) {
      let t = '<table>';
      if (!fd.rich_tooltip) {
        t += (
          '<thead><tr><td colspan="3">' +
            `<strong class='x-value'>${getCategory(d.depth)}</strong>` +
            '</td></tr></thead><tbody>'
        );
        t += (
          '<tr class="emph">' +
            '<td class="legend-color-guide" style="opacity: 0.75">' +
              `<div style='border: thin solid grey; background-color: ${d.color};'` +
              '></div>' +
            '</td>' +
            `<td>${d.name}</td>` +
            `<td>${d.disp}</td>` +
          '</tr>'
        );
      } else {
        const nodes = getAncestors(d);
        nodes.forEach((n) => {
          const atNode = n.depth === d.depth;
          t += '<tbody>';
          t += (
            `<tr class='${atNode ? 'emph' : ''}'>` +
              `<td class='legend-color-guide' style='opacity: ${atNode ? '1' : '0.75'}'>` +
                '<div ' +
                  `style='border: 2px solid ${atNode ? 'black' : 'transparent'};` +
                    `background-color: ${n.color};'` +
                '></div>' +
              '</td>' +
              `<td>${n.name}</td>` +
              `<td>${n.disp}</td>` +
              `<td>${getCategory(n.depth)}</td>` +
            '</tr>'
          );
        });
      }
      t += '</tbody></table>';
      tip.html(t)
        .style('left', (d3.event.pageX + 13) + 'px')
        .style('top', (d3.event.pageY - 10) + 'px');
    }

    const g = viz
      .selectAll('g')
      .data(init(root))
      .enter()
      .append('svg:g')
      .attr('transform', d => `translate(${x(d.y)},${y(d.x)})`)
      .on('click', click)
      .on('mouseover', (d) => {
        tooltip
          .interrupt()
          .transition()
          .duration(100)
          .style('opacity', 0.9);
        positionAndPopulate(tooltip, d);
      })
      .on('mousemove', (d) => {
        positionAndPopulate(tooltip, d);
      })
      .on('mouseout', () => {
        tooltip
          .interrupt()
          .transition()
          .duration(250)
          .style('opacity', 0);
      });

    let kx = w / root.dx;
    let ky = h / 1;

    g.append('svg:rect')
      .attr('width', root.dy * kx)
      .attr('height', d => d.dx * ky);

    g.append('svg:text')
      .attr('transform', transform)
      .attr('dy', '0.35em')
      .style('opacity', d => d.dx * ky > 12 ? 1 : 0)
      .text((d) => {
        if (!d.disp) {
          return d.name;
        }
        return `${d.name}: ${d.disp}`;
      });

    // Apply color scheme
    g.selectAll('rect')
      .style('fill', (d) => {
        d.color = getColorFromScheme(d.name, fd.color_scheme);
        return d.color;
      });

    // Zoom out when clicking outside vis
    // d3.select(window)
    // .on('click', () => click(root));

    // Keep text centered in its division
    function transform(d) {
      return `translate(8,${d.dx * ky / 2})`;
    }

    // When clicking a subdivision, the vis will zoom in to it
    function click(d) {
      if (!d.children) {
        if (d.parent) {
          // Clicking on the rightmost level should zoom in
          return click(d.parent);
        }
        return false;
      }
      kx = (d.y ? w - 40 : w) / (1 - d.y);
      ky = h / d.dx;
      x.domain([d.y, 1]).range([d.y ? 40 : 0, w]);
      y.domain([d.x, d.x + d.dx]);

      const t = g
        .transition()
        .duration(d3.event.altKey ? 7500 : 750)
        .attr('transform', nd => `translate(${x(nd.y)},${y(nd.x)})`);

      t.select('rect')
        .attr('width', d.dy * kx)
        .attr('height', nd => nd.dx * ky);

      t.select('text')
      .attr('transform', transform)
      .style('opacity', nd => nd.dx * ky > 12 ? 1 : 0);

      d3.event.stopPropagation();
      return true;
    }
  }
  for (let i = 0; i < data.length; i++) {
    drawVis(i, data);
  }
}

module.exports = partitionVis;
