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
/* eslint-disable no-shadow, no-param-reassign */
import d3 from 'd3';
import PropTypes from 'prop-types';
import { CategoricalColorNamespace } from '@superset-ui/color';
import { getNumberFormatter } from '@superset-ui/number-format';
import './Treemap.css';

// Declare PropTypes for recursive data structures
// https://github.com/facebook/react/issues/5676
const lazyFunction = f => (() => f().apply(this, arguments));

const leafType = PropTypes.shape({
  name: PropTypes.string,
  value: PropTypes.number.isRequired,
});

const parentShape = {
  name: PropTypes.string,
  children: PropTypes.arrayOf(PropTypes.oneOfType([
    PropTypes.shape(lazyFunction(() => parentShape)),
    leafType,
  ])),
};

const nodeType = PropTypes.oneOfType([
  PropTypes.shape(parentShape),
  leafType,
]);

const propTypes = {
  data: PropTypes.arrayOf(nodeType),
  width: PropTypes.number,
  height: PropTypes.number,
  colorScheme: PropTypes.string,
  margin: PropTypes.shape({
    top: PropTypes.number,
    right: PropTypes.number,
    bottom: PropTypes.number,
    left: PropTypes.number,
  }),
  numberFormat: PropTypes.string,
  treemapRatio: PropTypes.number,
};

const DEFAULT_MARGIN = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

function clone(children) {
  return children.map(x => ({
    ...x,
    children: x.children ? clone(x.children) : null,
  }));
}

/* Modified from http://bl.ocks.org/ganeshv/6a8e9ada3ab7f2d88022 */
function Treemap(element, props) {
  const {
    data: rawData,
    width,
    height,
    margin = DEFAULT_MARGIN,
    numberFormat,
    colorScheme,
    treemapRatio,
  } = props;
  const div = d3.select(element);
  const formatNumber = getNumberFormatter(numberFormat);
  const colorFn = CategoricalColorNamespace.getScale(colorScheme);
  const data = clone(rawData);

  function draw(data, eltWidth, eltHeight) {
    const navBarHeight = 36;
    const navBarTitleSize = navBarHeight / 3;
    const navBarBuffer = 10;
    const width = eltWidth - margin.left - margin.right;
    const height = (eltHeight - navBarHeight - navBarBuffer - margin.top - margin.bottom);
    let transitioning;

    const x = d3.scale.linear()
      .domain([0, width])
      .range([0, width]);

    const y = d3.scale.linear()
      .domain([0, height])
      .range([0, height]);

    const treemap = d3.layout.treemap()
      .children((d, depth) => depth ? null : d.originalChildren)
      .sort((a, b) => a.value - b.value)
      .ratio(treemapRatio)
      .mode('squarify')
      .round(false);

    const svg = div.append('svg')
      .attr('class', 'treemap')
      .attr('width', eltWidth)
      .attr('height', eltHeight);

    const chartContainer = svg.append('g')
      .attr('transform', 'translate(' + margin.left + ',' +
        (margin.top + navBarHeight + navBarBuffer) + ')')
      .style('shape-rendering', 'crispEdges');

    const grandparent = svg.append('g')
      .attr('class', 'grandparent')
      .attr('transform', 'translate(0,' + (margin.top + (navBarBuffer / 2)) + ')');

    grandparent.append('rect')
      .attr('width', width)
      .attr('height', navBarHeight);

    grandparent.append('text')
      .attr('x', width / 2)
      .attr('y', (navBarHeight / 2) + (navBarTitleSize / 2))
      .style('font-size', navBarTitleSize + 'px')
      .style('text-anchor', 'middle');

    const initialize = function (root) {
      root.x = 0;
      root.y = 0;
      root.dx = width;
      root.dy = height;
      root.depth = 0;
    };

    const text = function (selection) {
      selection.selectAll('tspan')
        .attr('x', d => x(d.x) + 6);
      selection
        .attr('x', d => x(d.x) + 6)
        .attr('y', d => y(d.y) + 6)
        .style('opacity', function (d) {
          return this.getComputedTextLength() < x(d.x + d.dx) - x(d.x) ? 1 : 0;
        });
    };

    const text2 = (selection) => {
      selection
        .attr('x', function (d) {
          return x(d.x + d.dx) - this.getComputedTextLength() - 6;
        })
        .attr('y', d => y(d.y + d.dy) - 6)
        .style('opacity', function (d) {
          return this.getComputedTextLength() < x(d.x + d.dx) - x(d.x) ? 1 : 0;
        });
    };

    const rect = (selection) => {
      selection
        .attr('x', d => x(d.x))
        .attr('y', d => y(d.y))
        .attr('width', d => x(d.x + d.dx) - x(d.x))
        .attr('height', d => y(d.y + d.dy) - y(d.y));
    };

    const name = function (d) {
      const value = formatNumber(d.value);
      return d.parent ?
        name(d.parent) + ' / ' + d.name + ' (' + value + ')' :
        (d.name) + ' (' + value + ')';
    };

    // Aggregate the values for internal nodes. This is normally done by the
    // treemap layout, but not here because of our custom implementation.
    // We also take a snapshot of the original children (originalChildren) to avoid
    // the children being overwritten when when layout is computed.
    const accumulate = function (d) {
      d.originalChildren = d.children;
      if (d.originalChildren) {
        d.value = d.children.reduce((p, v) => p + accumulate(v), 0);
      }
      return d.value;
    };

    // Compute the treemap layout recursively such that each group of siblings
    // uses the same size (1x1) rather than the dimensions of the parent cell.
    // This optimizes the layout for the current zoom state. Note that a wrapper
    // object is created for the parent node for each group of siblings so that
    // the parents dimensions are not discarded as we recurse. Since each group
    // of sibling was laid out in 1x1, we must rescale to fit using absolute
    // coordinates. This lets us use a viewport to zoom.
    const layout = function (d) {
      if (d.originalChildren) {
        treemap.nodes({
          originalChildren: d.originalChildren,
        });
        d.originalChildren.forEach(function (c) {
          c.x = d.x + (c.x * d.dx);
          c.y = d.y + (c.y * d.dy);
          c.dx *= d.dx;
          c.dy *= d.dy;
          c.parent = d;
          layout(c);
        });
      }
    };

    const display = function (d) {
      const g1 = chartContainer.append('g')
        .datum(d)
        .attr('class', 'depth');

      const transition = function (d) {
        if (transitioning || !d) {
          return;
        }
        transitioning = true;

        const g2 = display(d);
        const t1 = g1.transition().duration(750);
        const t2 = g2.transition().duration(750);

        // Update the domain only after entering new elements.
        x.domain([d.x, d.x + d.dx]);
        y.domain([d.y, d.y + d.dy]);

        // Enable anti-aliasing during the transition.
        chartContainer.style('shape-rendering', null);

        // Draw child nodes on top of parent nodes.
        chartContainer.selectAll('.depth')
          .sort((a, b) => a.depth - b.depth);

        // Fade-in entering text.
        g2.selectAll('text').style('fill-opacity', 0);

        // Transition to the new view.
        t1.selectAll('.ptext').call(text).style('fill-opacity', 0);
        t1.selectAll('.ctext').call(text2).style('fill-opacity', 0);
        t2.selectAll('.ptext').call(text).style('fill-opacity', 1);
        t2.selectAll('.ctext').call(text2).style('fill-opacity', 1);
        t1.selectAll('rect').call(rect);
        t2.selectAll('rect').call(rect);

        // Remove the old node when the transition is finished.
        t1.remove().each('end', function () {
          chartContainer.style('shape-rendering', 'crispEdges');
          transitioning = false;
        });
      };

      grandparent
        .datum(d.parent)
        .on('click', transition)
        .select('text')
        .text(name(d));

      const g = g1.selectAll('g')
        .data(d.originalChildren)
        .enter()
        .append('g');

      g.filter(d => d.originalChildren)
        .classed('children', true)
        .on('click', transition);

      const children = g.selectAll('.child')
        .data(d => d.originalChildren || [d])
        .enter()
        .append('g');

      children.append('rect')
        .attr('class', 'child')
        .call(rect)
        .append('title')
        .text(d => d.name + ' (' + formatNumber(d.value) + ')');

      children.append('text')
        .attr('class', 'ctext')
        .text(d => d.name)
        .call(text2);

      g.append('rect')
        .attr('class', 'parent')
        .call(rect);

      const t = g.append('text')
        .attr('class', 'ptext')
        .attr('dy', '.75em');

      t.append('tspan')
        .text(d => d.name);

      t.append('tspan')
        .attr('dy', '1.0em')
        .text(d => formatNumber(d.value));
      t.call(text);
      g.selectAll('rect')
        .style('fill', d => colorFn(d.name));

      return g;
    };

    initialize(data);
    accumulate(data);
    layout(data);
    display(data);
  }

  div.selectAll('*').remove();
  const eachHeight = height / data.length;
  data.forEach(d => draw(d, width, eachHeight));
}

Treemap.displayName = 'Treemap';
Treemap.propTypes = propTypes;

export default Treemap;
