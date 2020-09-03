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
/* eslint-disable no-param-reassign, func-names */
/* eslint-disable react/sort-prop-types */
import { select as d3Select, selectAll as d3SelectAll } from 'd3-selection';
import { treemap as d3Treemap, hierarchy as d3Hierarchy, treemapSquarify } from 'd3-hierarchy';
import PropTypes from 'prop-types';
import { getNumberFormatter, CategoricalColorNamespace } from '@superset-ui/core';
import './Treemap.css';

// Declare PropTypes for recursive data structures
// https://github.com/facebook/react/issues/5676
/* eslint-disable-next-line  no-undef */
const lazyFunction = f => () => f().apply(this, arguments);

const leafType = PropTypes.shape({
  name: PropTypes.string,
  value: PropTypes.number.isRequired,
});

const parentShape = {
  name: PropTypes.string,
  children: PropTypes.arrayOf(
    PropTypes.oneOfType([PropTypes.shape(lazyFunction(() => parentShape)), leafType]),
  ),
};

const nodeType = PropTypes.oneOfType([PropTypes.shape(parentShape), leafType]);

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

function hovered(hover) {
  return function (node) {
    d3SelectAll(node.ancestors().map(d => d.node))
      .classed('node--hover', hover)
      .select('rect')
      .attr('width', d => d.x1 - d.x0 - hover)
      .attr('height', d => d.y1 - d.y0 - hover);
  };
}

/* Modified from https://bl.ocks.org/mbostock/911ad09bdead40ec0061 */
function Treemap(element, props) {
  const { data: rawData, width, height, numberFormat, colorScheme, treemapRatio } = props;
  const div = d3Select(element);
  div.classed('superset-legacy-chart-treemap', true);

  const formatNumber = getNumberFormatter(numberFormat);
  const colorFn = CategoricalColorNamespace.getScale(colorScheme);

  const rootNodes = rawData;

  div.selectAll('*').remove();

  if (rootNodes.length > 0) {
    const [rootNode] = rootNodes;
    const treemap = d3Treemap()
      .size([width, height])
      .paddingOuter(3)
      .paddingTop(19)
      .paddingInner(1)
      .tile(treemapSquarify.ratio(treemapRatio))
      .round(true);

    const root = treemap(
      d3Hierarchy(rootNode)
        .sum(d => d.value)
        .sort((a, b) => b.height - a.height || b.value - a.value),
    );

    const svg = div
      .append('svg')
      .attr('class', 'treemap')
      .attr('width', width)
      .attr('height', height);

    const cell = svg
      .selectAll('.node')
      .data(root.descendants())
      .enter()
      .append('g')
      .attr('transform', d => `translate(${d.x0},${d.y0})`)
      .attr('class', 'node')
      .each(function (d) {
        d.node = this;
      })
      .on('mouseover', hovered(true))
      .on('mouseout', hovered(false));

    cell
      .append('rect')
      .attr('id', d => `rect-${d.data.name}`)
      .attr('width', d => d.x1 - d.x0)
      .attr('height', d => d.y1 - d.y0)
      .style('fill', d => colorFn(d.depth));

    cell
      .append('clipPath')
      .attr('id', d => `clip-${d.data.name}`)
      .append('use')
      .attr('xlink:href', d => `#rect-${d.data.name}`);

    const label = cell.append('text').attr('clip-path', d => `url(#clip-${d.data.name})`);

    label
      .filter(d => d.children)
      .selectAll('tspan')
      .data(d =>
        d.data.name
          .slice(Math.max(0, d.data.name.lastIndexOf('.') + 1))
          .split(/(?=[A-Z][^A-Z])/g)
          .concat(`\u00A0${formatNumber(d.value)}`),
      )
      .enter()
      .append('tspan')
      .attr('x', (d, i) => (i ? null : 4))
      .attr('y', 13)
      .text(d => d);

    label
      .filter(d => !d.children)
      .selectAll('tspan')
      .data(d =>
        d.data.name
          .slice(Math.max(0, d.data.name.lastIndexOf('.') + 1))
          .split(/(?=[A-Z][^A-Z])/g)
          .concat(formatNumber(d.value)),
      )
      .enter()
      .append('tspan')
      .attr('x', 4)
      .attr('y', (d, i) => 13 + i * 10)
      .text(d => d);

    cell.append('title').text(d => `${d.data.name}\n${formatNumber(d.value)}`);
  }
}

Treemap.displayName = 'Treemap';
Treemap.propTypes = propTypes;

export default Treemap;
