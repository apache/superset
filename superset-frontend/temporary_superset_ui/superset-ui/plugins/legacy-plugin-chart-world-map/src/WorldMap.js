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
import { extent as d3Extent } from 'd3-array';
import { getNumberFormatter, getSequentialSchemeRegistry } from '@superset-ui/core';
import Datamap from 'datamaps/dist/datamaps.world.min';

const propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      country: PropTypes.string,
      latitude: PropTypes.number,
      longitude: PropTypes.number,
      name: PropTypes.string,
      m1: PropTypes.number,
      m2: PropTypes.number,
    }),
  ),
  height: PropTypes.number,
  maxBubbleSize: PropTypes.number,
  showBubbles: PropTypes.bool,
  linearColorScheme: PropTypes.string,
  color: PropTypes.string,
};

const formatter = getNumberFormatter();

function WorldMap(element, props) {
  const { data, width, height, maxBubbleSize, showBubbles, linearColorScheme, color } = props;
  const div = d3.select(element);
  div.classed('superset-legacy-chart-world-map', true);
  div.selectAll('*').remove();

  // Ignore XXX's to get better normalization
  const filteredData = data.filter(d => d.country && d.country !== 'XXX');

  const extRadius = d3.extent(filteredData, d => Math.sqrt(d.m2));
  const radiusScale = d3.scale
    .linear()
    .domain([extRadius[0], extRadius[1]])
    .range([1, maxBubbleSize]);

  const colorScale = getSequentialSchemeRegistry()
    .get(linearColorScheme)
    .createLinearScale(d3Extent(filteredData, d => d.m1));

  const processedData = filteredData.map(d => ({
    ...d,
    radius: radiusScale(Math.sqrt(d.m2)),
    fillColor: colorScale(d.m1),
  }));

  const mapData = {};
  processedData.forEach(d => {
    mapData[d.country] = d;
  });

  const map = new Datamap({
    element,
    width,
    height,
    data: processedData,
    fills: {
      defaultFill: '#eee',
    },
    geographyConfig: {
      popupOnHover: true,
      highlightOnHover: true,
      borderWidth: 1,
      borderColor: '#feffff',
      highlightBorderColor: '#feffff',
      highlightFillColor: color,
      highlightBorderWidth: 1,
      popupTemplate: (geo, d) =>
        `<div class="hoverinfo"><strong>${d.name}</strong><br>${formatter(d.m1)}</div>`,
    },
    bubblesConfig: {
      borderWidth: 1,
      borderOpacity: 1,
      borderColor: color,
      popupOnHover: true,
      radius: null,
      popupTemplate: (geo, d) =>
        `<div class="hoverinfo"><strong>${d.name}</strong><br>${formatter(d.m2)}</div>`,
      fillOpacity: 0.5,
      animate: true,
      highlightOnHover: true,
      highlightFillColor: color,
      highlightBorderColor: 'black',
      highlightBorderWidth: 2,
      highlightBorderOpacity: 1,
      highlightFillOpacity: 0.85,
      exitDelay: 100,
      key: JSON.stringify,
    },
  });

  map.updateChoropleth(mapData);

  if (showBubbles) {
    map.bubbles(processedData);
    div.selectAll('circle.datamaps-bubble').style('fill', color).style('stroke', color);
  }
}

WorldMap.displayName = 'WorldMap';
WorldMap.propTypes = propTypes;

export default WorldMap;
