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
/* eslint-disable sort-keys */
import d3 from 'd3';
import PropTypes from 'prop-types';
import Datamap from 'datamaps/dist/datamaps.world.min';
import { getNumberFormatter } from '@superset-ui/number-format';
import './WorldMap.css';

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
};

const formatter = getNumberFormatter();

function WorldMap(element, props) {
  const { data, height, maxBubbleSize, showBubbles } = props;

  const div = d3.select(element);
  div.classed('superset-legacy-chart-world-map', true);

  const container = element;
  container.style.height = `${height}px`;
  div.selectAll('*').remove();

  // Ignore XXX's to get better normalization
  const filteredData = data.filter(d => d.country && d.country !== 'XXX');

  const ext = d3.extent(filteredData, d => d.m1);
  const extRadius = d3.extent(filteredData, d => d.m2);
  const radiusScale = d3.scale
    .linear()
    .domain([extRadius[0], extRadius[1]])
    .range([1, maxBubbleSize]);

  // color gradient based on http://colorbrewer2.org/#type=sequential&scheme=Greens&n=9
  const colorScale = d3.scale
    .linear()
    .domain([ext[0], ext[1]])
    .range(['#c7e9c0', '#00441b']);

  const processedData = filteredData.map(d => ({
    ...d,
    radius: radiusScale(d.m2),
    fillColor: colorScale(d.m1),
  }));

  const mapData = {};
  processedData.forEach(d => {
    mapData[d.country] = d;
  });

  const map = new Datamap({
    element,
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
      highlightFillColor: '#00749A',
      highlightBorderWidth: 1,
      popupTemplate: (geo, d) =>
        `<div class="hoverinfo"><strong>${d.name}</strong><br>${formatter(d.m1)}</div>`,
    },
    bubblesConfig: {
      borderWidth: 1,
      borderOpacity: 1,
      borderColor: '#00749A',
      popupOnHover: true,
      radius: null,
      popupTemplate: (geo, d) =>
        `<div class="hoverinfo"><strong>${d.name}</strong><br>${formatter(d.m2)}</div>`,
      fillOpacity: 0.5,
      animate: true,
      highlightOnHover: true,
      highlightFillColor: '#00749A',
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
    div.selectAll('circle.datamaps-bubble').style('fill', '#00749A');
  }
}

WorldMap.displayName = 'WorldMap';
WorldMap.propTypes = propTypes;

export default WorldMap;
