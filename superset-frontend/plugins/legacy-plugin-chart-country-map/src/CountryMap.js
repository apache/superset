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
  customColorScale: PropTypes.array,
};

const maps = {};

function normalizeColorKeyword(color) {
  if (color == null) return '#000000';
  const c = String(color).trim();

  // Hex colors (#RGB, #RRGGBB, #RGBA, #RRGGBBAA)
  if (/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(c)) return c;

  // CSS color functions (rgb, rgba, hsl, hsla) with flexible spacing and alpha
  const colorFuncRegex =
    /^(rgb|rgba)\(\s*(\d{1,3}%?\s*,\s*){2}\d{1,3}%?(?:\s*,\s*(\d*\.?\d+))?\s*\)$/i;
  const colorFuncHslRegex =
    /^(hsl|hsla)\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%(?:\s*,\s*(\d*\.?\d+))?\s*\)$/i;
  if (colorFuncRegex.test(c) || colorFuncHslRegex.test(c)) return c;

  // Named CSS colors and system colors - guard for non-browser environments
  try {
    if (typeof Option !== 'undefined') {
      const s = new Option().style;
      s.color = c.toLowerCase();
      if (s.color) return c;
    }
  } catch {
    // ignore environment where Option is not available
  }

  // Fallback
  return '#000000';
}

function safeNumber(v) {
  if (v === null || v === undefined || v === '') return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function normalizeScale(scale) {
  if (Array.isArray(scale)) return scale;
  if (typeof scale === 'string') {
    try {
      return JSON.parse(scale);
    } catch {
      return [];
    }
  }
  return [];
}

function CountryMap(element, props) {
  const {
    data,
    width,
    height,
    country,
    linearColorScheme,
    numberFormat,
    customColorScale = props.customColorScale || [],
    colorScheme,
    sliceId,
  } = props;

  const container = element;
  const format = getNumberFormatter(numberFormat);
  const normalizedScale = normalizeScale(customColorScale);
  const normalizedScaleWithColors = Array.isArray(normalizedScale)
    ? normalizedScale.map(e => {
        if (!e || typeof e !== 'object') return e;
        return { ...e, color: normalizeColorKeyword(e.color) };
      })
    : [];

  const parsedData = Array.isArray(data)
    ? data.map(r => ({ ...r, metric: safeNumber(r.metric) }))
    : [];

  const numericValues = parsedData
    .map(r => r.metric)
    .filter(v => Number.isFinite(v));

  let minValue = 0;
  let maxValue = 1;
  if (numericValues.length > 0) {
    const extent = d3Extent(numericValues);
    minValue = extent[0];
    maxValue = extent[1];
  }
  const valueRange = maxValue - minValue;
  const valueRangeNonZero = valueRange === 0 ? 1 : valueRange;

  let percentColorScale = null;
  if (
    Array.isArray(normalizedScaleWithColors) &&
    normalizedScaleWithColors.length >= 2
  ) {
    const sorted = normalizedScaleWithColors
      .filter(
        e =>
          e &&
          typeof e.percent === 'number' &&
          e.percent >= 0 &&
          e.percent <= 100 &&
          typeof e.color === 'string',
      )
      .slice()
      .sort((a, b) => a.percent - b.percent);

    if (sorted.length >= 2) {
      const domainPerc = sorted.map(e => e.percent);
      const rangeColors = sorted.map(e => e.color);
      percentColorScale = d3.scale
        .linear()
        .domain(domainPerc)
        .range(rangeColors)
        .clamp(true)
        // Remove interpolation to avoid blending between steps - always return lower boundary
        .interpolate(function (a, b) {
          return function(t) { return a; };
        });
    }
  }

  let linearPaletteScale = null;
  if (linearColorScheme) {
    try {
      const seq = getSequentialSchemeRegistry().get(linearColorScheme);
      if (seq && typeof seq.createLinearScale === 'function') {
        linearPaletteScale = seq.createLinearScale([minValue, maxValue]);
      } else if (seq && Array.isArray(seq.colors) && seq.colors.length >= 2) {
        linearPaletteScale = d3.scale
          .linear()
          .domain([minValue, maxValue])
          .range([seq.colors[0], seq.colors[seq.colors.length - 1]])
          .interpolate(d3.interpolateRgb);
      }
    } catch {
      linearPaletteScale = null;
    }
  }

  const colorMap = {};
  parsedData.forEach(r => {
    const iso = r.country_id;
    const value = r.metric;
    if (!iso) return;
    if (!Number.isFinite(value)) {
      colorMap[iso] = 'none';
      return;
    }

    if (percentColorScale) {
      if (minValue === maxValue) {
        // All values are the same; map to central color (e.g., 50%)
        try {
          colorMap[iso] = percentColorScale(50);
          return;
        } catch {
          // continue regardless of error
        }
      } else {
        const percentNormalized =
          ((value - minValue) / valueRangeNonZero) * 100;
        const p = Math.max(0, Math.min(100, percentNormalized));
        try {
          colorMap[iso] = percentColorScale(p);
          return;
        } catch {
          // continue regardless of error
        }
      }
    } else if (linearPaletteScale) {
      try {
        colorMap[iso] = linearPaletteScale(value);
        return;
      } catch {
        // continue regardless of error
      }
    } else {
      colorMap[iso] = 'none';
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
  const hoverPopup = div.append('div').attr('class', 'hover-popup');

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
  };

  backgroundRect.on('click', clicked);

  const getNameOfRegion = function getNameOfRegion(feature) {
    if (feature && feature.properties) {
      if (feature.properties.ID_2) {
        return feature.properties.NAME_2;
      }
      return feature.properties.NAME_1;
    }
    return '';
  };

  const mouseenter = function mouseenter(d) {
    // Darken color
    let c = colorFn(d);
    if (c !== 'none') {
      c = d3.rgb(c).darker().toString();
    }
    d3.select(this).style('fill', c);
    // Display information popup
    const result = data.filter(
      region => region.country_id === d.properties.ISO,
    );

    const position = d3.mouse(svg.node());
    hoverPopup
      .style('display', 'block')
      .style('top', `${position[1] + 30}px`)
      .style('left', `${position[0]}px`)
      .html(
        `<div><strong>${getNameOfRegion(d)}</strong><br>${result.length > 0 ? format(result[0].metric) : ''}</div>`,
      );
  };

  const mousemove = function mousemove() {
    const position = d3.mouse(svg.node());
    hoverPopup
      .style('top', `${position[1] + 30}px`)
      .style('left', `${position[0]}px`);
  };

  const mouseout = function mouseout() {
    d3.select(this).style('fill', colorFn);
    hoverPopup.style('display', 'none');
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
      .on('mousemove', mousemove)
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
