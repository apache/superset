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
import {
  getNumberFormatter,
  getSequentialSchemeRegistry,
  CategoricalColorNamespace,
} from '@superset-ui/core';
import countries, { countryOptions } from './countries';
import { ColorBy } from './utils';
import { 
  allocateEnhancedColors,
  getColorAllocationSummary,
} from '../../../src/utils/enhancedColorUtils';

const propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      country_id: PropTypes.string,
      metric: PropTypes.number,
    }),
  ),
  width: PropTypes.number,
  height: PropTypes.number,
  country: PropTypes.string,
  colorScheme: PropTypes.string,
  linearColorScheme: PropTypes.string,
  mapBaseUrl: PropTypes.string,
  numberFormat: PropTypes.string,
  colorBy: PropTypes.string,
};

const maps = {};

function CountryMap(element, props) {
  const {
    data,
    width,
    height,
    country,
    linearColorScheme,
    numberFormat,
    colorScheme,
    colorBy,
    sliceId,
  } = props;

  const container = element;
  const format = getNumberFormatter(numberFormat);
  
  // Enhanced color allocation with theme integration and collision avoidance
  const values = data.map(d => d.metric);
  const names = data.map(d => d.country_id);
  
  // Get theme from container element (fallback to default theme structure)
  const theme = {
    colors: {
      primary: { base: '#20A7C9', dark1: '#1A85A0', dark2: '#156378', light1: '#79CADE', light2: '#A5DAE9', light3: '#D2EDF4', light4: '#E9F6F9', light5: '#F3F8FA' },
      secondary: { base: '#444E7C', dark1: '#363E63', dark2: '#282E4A', dark3: '#1B1F31', light1: '#8E94B0', light2: '#B4B8CA', light3: '#D9DBE4', light4: '#ECEEF2', light5: '#F5F5F8' },
      success: { base: '#5AC189', dark1: '#439066', dark2: '#2B6144', light1: '#ACE1C4', light2: '#EEF8F3' },
      warning: { base: '#FF7F44', dark1: '#BF5E33', dark2: '#7F3F21', light1: '#FEC0A1', light2: '#FFF2EC' },
      error: { base: '#E04355', dark1: '#A7323F', dark2: '#6F212A', light1: '#EFA1AA', light2: '#FAEDEE' },
      alert: { base: '#FCC700', dark1: '#BC9501', dark2: '#7D6300', light1: '#FDE380', light2: '#FEF9E6' },
      info: { base: '#66BCFE', dark1: '#4D8CBE', dark2: '#315E7E', light1: '#B3DEFE', light2: '#EFF8FE' },
      grayscale: { base: '#666666', dark1: '#323232', dark2: '#000000', light1: '#B2B2B2', light2: '#E0E0E0', light3: '#F0F0F0', light4: '#F7F7F7', light5: '#FFFFFF' }
    }
  };

  // Use enhanced color allocation
  const colorAllocationOptions = {
    theme,
    sectionCount: data.length,
    useValueBasedColors: colorBy !== ColorBy.Region,
    values: colorBy !== ColorBy.Region ? values : undefined,
    colorScheme: colorBy === ColorBy.Region ? colorScheme : linearColorScheme,
    avoidCollisions: true, // Always avoid color collisions
  };

  const colorAllocation = allocateEnhancedColors(colorAllocationOptions);
  
  // Log color allocation summary for debugging
  if (process.env.NODE_ENV === 'development') {
    console.log('Country Map Color Allocation:', getColorAllocationSummary(colorAllocation));
  }

  // Create enhanced color map ensuring unique colors
  const colorMap = {};
  data.forEach((d, index) => {
    if (colorBy === ColorBy.Region) {
      // For categorical colors, use consistent colors for same names
      const colorIndex = names.indexOf(d.country_id);
      colorMap[d.country_id] = colorAllocation.colors[colorIndex] || colorAllocation.colors[index % colorAllocation.colors.length];
    } else {
      // For value-based colors, use the allocated colors based on value order
      colorMap[d.country_id] = colorAllocation.colors[index] || colorAllocation.colors[0];
    }
  });

  const colorFn = d => colorMap[d.properties.ISO] || 'none';

  const path = d3.geo.path();
  const div = d3.select(container);
  div.classed('superset-legacy-chart-country-map', true);
  div.selectAll('*').remove();
  container.style.height = `${height}px`;
  container.style.width = `${width}px`;
  const svg = div
    .append('svg:svg')
    .attr('width', width)
    .attr('height', height)
    .attr('preserveAspectRatio', 'xMidYMid meet');
  const backgroundRect = svg
    .append('rect')
    .attr('class', 'background')
    .attr('width', width)
    .attr('height', height);
  const g = svg.append('g');
  const mapLayer = g.append('g').classed('map-layer', true);
  const textLayer = g
    .append('g')
    .classed('text-layer', true)
    .attr('transform', `translate(${width / 2}, 45)`);
  const bigText = textLayer.append('text').classed('big-text', true);
  const resultText = textLayer
    .append('text')
    .classed('result-text', true)
    .attr('dy', '1em');

  let centered;

  const clicked = function clicked(d) {
    const hasCenter = d && centered !== d;
    let x;
    let y;
    let k;
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    if (hasCenter) {
      const centroid = path.centroid(d);
      [x, y] = centroid;
      k = 4;
      centered = d;
    } else {
      x = halfWidth;
      y = halfHeight;
      k = 1;
      centered = null;
    }

    g.transition()
      .duration(750)
      .attr(
        'transform',
        `translate(${halfWidth},${halfHeight})scale(${k})translate(${-x},${-y})`,
      );
    textLayer
      .style('opacity', 0)
      .attr(
        'transform',
        `translate(0,0)translate(${x},${hasCenter ? y - 5 : 45})`,
      )
      .transition()
      .duration(750)
      .style('opacity', 1);
    bigText
      .transition()
      .duration(750)
      .style('font-size', hasCenter ? 6 : 16);
    resultText
      .transition()
      .duration(750)
      .style('font-size', hasCenter ? 16 : 24);
  };

  backgroundRect.on('click', clicked);

  const selectAndDisplayNameOfRegion = function selectAndDisplayNameOfRegion(
    feature,
  ) {
    let name = '';
    if (feature && feature.properties) {
      if (feature.properties.ID_2) {
        name = feature.properties.NAME_2;
      } else {
        name = feature.properties.NAME_1;
      }
    }
    bigText.text(name);
  };

  const updateMetrics = function updateMetrics(region) {
    if (region.length > 0) {
      resultText.text(format(region[0].metric));
    }
  };

  const mouseenter = function mouseenter(d) {
    // Darken color
    let c = colorFn(d);
    if (c !== 'none') {
      c = d3.rgb(c).darker().toString();
    }
    d3.select(this).style('fill', c);
    selectAndDisplayNameOfRegion(d);
    const result = data.filter(
      region => region.country_id === d.properties.ISO,
    );
    updateMetrics(result);
  };

  const mouseout = function mouseout() {
    d3.select(this).style('fill', colorFn);
    bigText.text('');
    resultText.text('');
  };

  function drawMap(mapData) {
    const { features } = mapData;
    const center = d3.geo.centroid(mapData);
    const scale = 100;
    const projection = d3.geo
      .mercator()
      .scale(scale)
      .center(center)
      .translate([width / 2, height / 2]);
    path.projection(projection);

    // Compute scale that fits container.
    const bounds = path.bounds(mapData);
    const hscale = (scale * width) / (bounds[1][0] - bounds[0][0]);
    const vscale = (scale * height) / (bounds[1][1] - bounds[0][1]);
    const newScale = hscale < vscale ? hscale : vscale;

    // Compute bounds and offset using the updated scale.
    projection.scale(newScale);
    const newBounds = path.bounds(mapData);
    projection.translate([
      width - (newBounds[0][0] + newBounds[1][0]) / 2,
      height - (newBounds[0][1] + newBounds[1][1]) / 2,
    ]);

    // Draw each province as a path
    mapLayer
      .selectAll('path')
      .data(features)
      .enter()
      .append('path')
      .attr('d', path)
      .attr('class', 'region')
      .attr('vector-effect', 'non-scaling-stroke')
      .style('fill', colorFn)
      .on('mouseenter', mouseenter)
      .on('mouseout', mouseout)
      .on('click', clicked);
  }

  const map = maps[country];
  if (map) {
    drawMap(map);
  } else {
    const url = countries[country];
    d3.json(url, (error, mapData) => {
      if (error) {
        const countryName =
          countryOptions.find(x => x[0] === country)?.[1] || country;
        d3.select(element).html(
          `<div class="alert alert-danger">Could not load map data for ${countryName}</div>`,
        );
      } else {
        maps[country] = mapData;
        drawMap(mapData);
      }
    });
  }
}

CountryMap.displayName = 'CountryMap';
CountryMap.propTypes = propTypes;

export default CountryMap;
