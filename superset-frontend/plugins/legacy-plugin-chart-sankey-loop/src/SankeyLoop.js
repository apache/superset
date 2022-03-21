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
/* eslint-disable react/sort-prop-types */
import PropTypes from 'prop-types';
import { select } from 'd3-selection';
import { sankeyDiagram, sankey } from 'd3-sankey-diagram';
import {
  getNumberFormatter,
  NumberFormats,
  CategoricalColorNamespace,
} from '@superset-ui/core';

import './SankeyLoop.css';

// a problem with 'd3-sankey-diagram'  is that the sankey().extent() paramters, which
// informs the layout of the bounding box of the sankey columns, does not account
// for labels and paths which happen to be layedout outside that rectangle.
// for that reason i've selected relatively large default left/right margins, and have
// made 'margin' a property.   i have raised an issue in the chart repo:
//
//   https://github.com/ricklupton/d3-sankey-diagram/issues/20

const defaultMargin = {
  top: 0,
  right: 80,
  bottom: 0,
  left: 80,
};

const propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      source: PropTypes.string,
      target: PropTypes.string,
      value: PropTypes.number,
    }),
  ),
  width: PropTypes.number,
  height: PropTypes.number,
  colorScheme: PropTypes.string,
  margin: PropTypes.shape({
    top: PropTypes.number,
    right: PropTypes.number,
    bottom: PropTypes.number,
    left: PropTypes.number,
  }),
};

const percentFormat = getNumberFormatter(NumberFormats.PERCENT_1_POINT);
const countFormat = getNumberFormatter();

function computeGraph(links) {
  // this assumes source and target are string values
  const nodes = Array.from(
    links.reduce(
      (set, { source, target }) => set.add(source).add(target),
      new Set(),
    ),
  ).map(id => ({ id, name: id }));

  return {
    nodes,

    // links are shallow copied as the chart layout modifies them, and it is best to
    // leave the passed data un-altered
    links: links.map(d => ({ ...d })),
  };
}

function SankeyLoop(element, props) {
  const { data, width, height, colorScheme, sliceId } = props;
  const color = CategoricalColorNamespace.getScale(colorScheme);
  const margin = { ...defaultMargin, ...props.margin };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const layout = sankey()
    .nodeId(d => d.id)
    .extent([
      [margin.left, margin.top],
      [innerWidth, innerHeight],
    ]);

  const diagram = sankeyDiagram()
    .nodeTitle(d => d.name)
    .linkTitle(
      ({
        source: { name: sName, value: sValue },
        target: { name: tName },
        value,
      }) =>
        `${sName} → ${tName}: ${countFormat(value)} (${percentFormat(
          value / sValue,
        )})`,
    )
    .linkColor(d => color(d.source.name, sliceId));

  const div = select(element);
  div.selectAll('*').remove();

  const svg = div
    .append('svg')
    .classed('superset-legacy-chart-sankey-loop', true)
    .style('width', width)
    .style('height', height)
    .datum(layout(computeGraph(data)))
    .call(diagram);

  svg
    .selectAll('g.link')
    .classed('link', true)
    .append('text')
    .attr('x', d => d.points[0].x)
    .attr('y', d => d.points[0].y)
    .attr('dy', 3)
    .attr('dx', 2)
    .text(
      d =>
        `${countFormat(d.value)} (${percentFormat(d.value / d.source.value)})`,
    );
}

SankeyLoop.displayName = 'SankeyLoop';
SankeyLoop.propTypes = propTypes;

export default SankeyLoop;
