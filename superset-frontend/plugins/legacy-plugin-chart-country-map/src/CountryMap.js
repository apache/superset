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

  // Named CSS colors and system colors
  const s = new Option().style;
  s.color = c.toLowerCase();
  if (s.color) return c;

  // Fallback
  return '#000000';
}

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
  sliceId: PropTypes.number,
  customColorRules: PropTypes.array,
  minColor: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  maxColor: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  customColorScale: PropTypes.array,
};

const maps = {};

function safeNumber(v) {
  if (v === null || v === undefined || v === '') return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function rgbaToHex(rgba) {
  if (typeof rgba === 'string') return rgba;
  if (Array.isArray(rgba)) return rgbaToHex(rgba[0]);
  if (!rgba || typeof rgba !== 'object') return null;
  const { r, g, b } = rgba;
  if (r === undefined || g === undefined || b === undefined) return null;
  const toHex = n => {
    const hex = Math.round(n).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
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
    customColorRules = [],
    customColorScale = [],
    minColor,
    maxColor,
    colorScheme,
    sliceId,
  } = props;

  const minColorHexRaw = rgbaToHex(minColor) || '#f7fbff';
  const maxColorHexRaw = rgbaToHex(maxColor) || '#08306b';
  const minColorHex = normalizeColorKeyword(minColorHexRaw);
  const maxColorHex = normalizeColorKeyword(maxColorHexRaw);

  const container = element;
  const format = getNumberFormatter(numberFormat);
  const normalizedScale = normalizeScale(customColorScale);
  const normalizedScaleWithColors = Array.isArray(normalizedScale)
    ? normalizedScale.map(e => {
        if (!e || typeof e !== 'object') return e;
        return { ...e, color: normalizeColorKeyword(e.color) };
      })
    : [];

  // Parse metrics to numbers safely
  const parsedData = Array.isArray(data)
    ? data.map(r => ({ ...r, metric: safeNumber(r.metric) }))
    : [];

  // numeric values only
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

  /** -------------------------
   * 1) Custom conditional rules
   * ------------------------- */
  // Preprocess customColorRules for efficient lookup
  let valueRuleMap = {};
  let rangeRules = [];
  if (Array.isArray(customColorRules)) {
    for (const rule of customColorRules) {
      if (
        rule &&
        typeof rule.color === 'string' &&
        (('min' in rule && 'max' in rule) || 'value' in rule)
      ) {
        if ('value' in rule && Number.isFinite(Number(rule.value))) {
          valueRuleMap[Number(rule.value)] = normalizeColorKeyword(rule.color);
        } else if ('min' in rule && 'max' in rule) {
          const minR = safeNumber(rule.min);
          const maxR = safeNumber(rule.max);
          if (Number.isFinite(minR) && Number.isFinite(maxR)) {
            rangeRules.push({
              min: minR,
              max: maxR,
              color: normalizeColorKeyword(rule.color),
            });
          }
        }
      }
    }
    // Sort rangeRules by min for possible future optimizations
    rangeRules.sort((a, b) => a.min - b.min);
  }
  const getColorFromRules = value => {
    if (!Number.isFinite(value)) return null;
    // Check for exact value match first
    if (Object.prototype.hasOwnProperty.call(valueRuleMap, value)) {
      return valueRuleMap[value];
    }
    // Check range rules
    for (const rule of rangeRules) {
      if (value >= rule.min && value <= rule.max) {
        return rule.color;
      }
    }
    return null;
  };

  /** -------------------------
   * 2) Custom color scale (by %)
   * ------------------------- */
  let percentColorScale = null;
  if (
    Array.isArray(normalizedScaleWithColors) &&
    normalizedScaleWithColors.length >= 2
  ) {
    const sorted = normalizedScaleWithColors
      .filter(
        e => e && typeof e.percent === 'number' && typeof e.color === 'string',
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
        // Remove interpolation to avoid blending between steps
        .interpolate(function(a, b) { 
          return function(t) {
            return t < 0.5 ? a : b;
          };
        });
    }
  }

  /** -------------------------
   * 3) Linear palette from registry if defined)
   * ------------------------- */
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

  /** -------------------------
   * 4) Gradient fallback (minColor → maxColor) with HEX
   * ------------------------- */
  let gradientColorScale;
  if (minValue === maxValue) {
    gradientColorScale = () => minColorHex || maxColorHex || '#ddd';
  } else {
    gradientColorScale = d3.scale
      .linear()
      .domain([minValue, maxValue])
      .range([minColorHex, maxColorHex])
      .interpolate(d3.interpolateRgb);
  }

  /** -------------------------
   * Build final color (priority)
   * rules > customScale > linearPalette > gradient
   * ------------------------- */
  const colorMap = {};
  parsedData.forEach(r => {
    const iso = r.country_id;
    const value = r.metric;
    if (!iso) return;
    if (!Number.isFinite(value)) {
      colorMap[iso] = 'none';
      return;
    }

    const ruleColor = getColorFromRules(value);
    if (ruleColor) {
      colorMap[iso] = ruleColor;
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
    }

    if (linearPaletteScale) {
      try {
        colorMap[iso] = linearPaletteScale(value);
        return;
      } catch {
        // continue regardless of error
      }
    }

    try {
      colorMap[iso] = gradientColorScale(value);
    } catch {
      colorMap[iso] = '#ccc';
    }
  });
  const fallbackCategorical = CategoricalColorNamespace.getScale(colorScheme);
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
