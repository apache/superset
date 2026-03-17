// @ts-nocheck
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
import { extent as d3Extent } from 'd3-array';
import {
  getNumberFormatter,
  getSequentialSchemeRegistry,
  CategoricalColorNamespace,
} from '@superset-ui/core';
import countries, { countryOptions } from './countries';

/**
 * Escape HTML special characters to prevent XSS attacks
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

interface CountryMapDataItem {
  country_id: string;
  metric: number;
}

interface GeoFeature {
  properties: {
    ISO: string;
    ID_2?: string;
    NAME_1?: string;
    NAME_2?: string;
  };
}

interface GeoData {
  features: GeoFeature[];
}

interface CountryMapProps {
  data: CountryMapDataItem[];
  width: number;
  height: number;
  country: string;
  linearColorScheme: string;
  numberFormat: string;
  colorScheme: string;
  sliceId: number;
}

const maps: Record<string, GeoData> = {};

function CountryMap(element: HTMLElement, props: CountryMapProps) {
  const {
    data,
    width,
    height,
    country,
    linearColorScheme,
    numberFormat,
    colorScheme,
    sliceId,
  } = props;

  const container = element;
  const format = getNumberFormatter(numberFormat);
  const rawExtents = d3Extent(data, v => v.metric);
  const extents: [number, number] =
    rawExtents[0] != null && rawExtents[1] != null
      ? [rawExtents[0], rawExtents[1]]
      : [0, 1];
  const colorSchemeObj = getSequentialSchemeRegistry().get(linearColorScheme);
  const linearColorScale = colorSchemeObj
    ? colorSchemeObj.createLinearScale(extents)
    : () => '#ccc'; // fallback if scheme not found
  const colorScale = CategoricalColorNamespace.getScale(colorScheme);

  const colorMap: Record<string, string> = {};
  data.forEach(d => {
    colorMap[d.country_id] = colorScheme
      ? colorScale(d.country_id, sliceId)
      : (linearColorScale(d.metric) ?? '');
  });
  const colorFn = (d: GeoFeature) => colorMap[d.properties.ISO] || 'none';

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

  let centered: GeoFeature | null;

  const clicked = function clicked(d: GeoFeature) {
    const hasCenter = d && centered !== d;
    let x: number;
    let y: number;
    let k: number;
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

  const getNameOfRegion = function getNameOfRegion(
    feature: GeoFeature,
  ): string {
    if (feature && feature.properties) {
      if (feature.properties.ID_2) {
        return feature.properties.NAME_2 || '';
      }
      return feature.properties.NAME_1 || '';
    }
    return '';
  };

  const mouseenter = function mouseenter(this: SVGPathElement, d: GeoFeature) {
    // Darken color
    let c: string = colorFn(d);
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

  const mouseout = function mouseout(this: SVGPathElement) {
    d3.select(this).style('fill', colorFn);
    hoverPopup.style('display', 'none');
  };

  function drawMap(mapData: GeoData) {
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
    const url = (countries as Record<string, string>)[country];
    if (!url) {
      const countryName =
        countryOptions.find(x => x[0] === country)?.[1] || country;
      d3.select(element).html(
        `<div class="alert alert-danger">No map data available for ${escapeHtml(countryName)}</div>`,
      );
      return;
    }
    d3.json(url, (error: unknown, mapData: GeoData) => {
      if (error) {
        const countryName =
          countryOptions.find(x => x[0] === country)?.[1] || country;
        d3.select(element).html(
          `<div class="alert alert-danger">Could not load map data for ${escapeHtml(countryName)}</div>`,
        );
      } else {
        maps[country] = mapData;
        drawMap(mapData);
      }
    });
  }
}

CountryMap.displayName = 'CountryMap';

export default CountryMap;
