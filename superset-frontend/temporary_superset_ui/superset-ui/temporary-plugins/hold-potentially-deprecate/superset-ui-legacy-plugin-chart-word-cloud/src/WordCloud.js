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

import d3 from 'd3';
import PropTypes from 'prop-types';
import cloudLayout from 'd3-cloud';
import { CategoricalColorNamespace, seedRandom } from '@superset-ui/core';

const ROTATION = {
  square: () => Math.floor(seedRandom() * 2) * 90,
  flat: () => 0,
  random: () => Math.floor(seedRandom() * 6 - 3) * 30,
};

const propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      size: PropTypes.number,
      text: PropTypes.string,
    }),
  ),
  width: PropTypes.number,
  height: PropTypes.number,
  rotation: PropTypes.string,
  sizeRange: PropTypes.arrayOf(PropTypes.number),
  colorScheme: PropTypes.string,
};

function WordCloud(element, props) {
  const { data, width, height, rotation, sizeRange, colorScheme } = props;

  const chart = d3.select(element);
  chart.classed('superset-legacy-chart-word-cloud', true);
  const size = [width, height];
  const rotationFn = ROTATION[rotation] || ROTATION.flat;

  const scale = d3.scale
    .linear()
    .range(sizeRange)
    .domain(d3.extent(data, d => d.size));

  const layout = cloudLayout()
    .size(size)
    .words(data)
    .padding(5)
    .rotate(rotationFn)
    .font('Helvetica')
    .fontWeight('bold')
    .fontSize(d => scale(d.size));

  const colorFn = CategoricalColorNamespace.getScale(colorScheme);

  function draw(words) {
    chart.selectAll('*').remove();

    const [w, h] = layout.size();

    chart
      .append('svg')
      .attr('width', w)
      .attr('height', h)
      .append('g')
      .attr('transform', `translate(${w / 2},${h / 2})`)
      .selectAll('text')
      .data(words)
      .enter()
      .append('text')
      .style('font-size', d => `${d.size}px`)
      .style('font-weight', 'bold')
      .style('font-family', 'Helvetica')
      .style('fill', d => colorFn(d.text))
      .attr('text-anchor', 'middle')
      .attr('transform', d => `translate(${d.x}, ${d.y}) rotate(${d.rotate})`)
      .text(d => d.text);
  }

  layout.on('end', draw).start();
}

WordCloud.displayName = 'WordCloud';
WordCloud.propTypes = propTypes;

export default WordCloud;
