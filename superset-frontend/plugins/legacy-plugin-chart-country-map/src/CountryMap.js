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
  onContextMenu: PropTypes.func,
  emitCrossFilters: PropTypes.bool,
  setDataMask: PropTypes.func,
  filterState: PropTypes.object,
  entity: PropTypes.string,
  sliceId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

const maps = {};
// Store zoom state per chart instance
const zoomStates = {};

function CountryMap(element, props) {
  const {
    data = [],
    width = 800,
    height = 400,
    country,
    entity,
    linearColorScheme,
    numberFormat,
    colorScheme,
    sliceId,
    filterState = {},
    emitCrossFilters = false,
    onContextMenu,
    setDataMask,
  } = props;

  const container = element;
  const format = getNumberFormatter(numberFormat);

  // Use sliceId as unique key for this chart instance
  const chartKey = sliceId || `${country}-${width}-${height}`;

  const linearColorScale = getSequentialSchemeRegistry()
    .get(linearColorScheme)
    .createLinearScale(d3Extent(data, v => (v ? v.metric : 0)));

  const colorScale = CategoricalColorNamespace.getScale(colorScheme);

  const colorMap = {};
  data.forEach(d => {
    colorMap[d.country_id] = colorScheme
      ? colorScale(d.country_id, sliceId)
      : linearColorScale(d.metric);
  });

  const colorFn = feature => {
    if (!feature?.properties) return 'none';
    const iso = feature.properties.ISO;
    return colorMap[iso] || '#FFFEFE';
  };

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

  const g = svg.append('g');
  const mapLayer = g.append('g').classed('map-layer', true);

  const textLayer = svg
    .append('g')
    .attr('class', 'text-layer')
    .attr('transform', `translate(${width / 2}, 45)`);

  const bigText = textLayer
    .append('text')
    .classed('big-text', true)
    .style('font-size', '18px');

  const resultText = textLayer
    .append('text')
    .classed('result-text', true)
    .attr('dy', '1em')
    .style('font-size', '26px');

  // Cross-filter support
  const getCrossFilterDataMask = source => {
    const selected = filterState.selectedValues || [];
    const iso = source?.properties?.ISO;
    if (!iso) return undefined;

    const isSelected = selected.includes(iso);
    const values = isSelected ? [] : [iso];

    return {
      dataMask: {
        extraFormData: {
          filters: values.length
            ? [{ col: entity, op: 'IN', val: values }]
            : [],
        },
        filterState: {
          value: values.length ? values : null,
          selectedValues: values.length ? values : null,
        },
      },
      isCurrentValueSelected: isSelected,
    };
  };

  // Handle right-click context menu
  const handleContextMenu = feature => {
    const pointerEvent = d3.event;

    // Only prevent default if we have a context menu handler
    if (typeof onContextMenu === 'function') {
      pointerEvent?.preventDefault();
    }

    const iso = feature?.properties?.ISO;
    if (!iso || typeof onContextMenu !== 'function') return;

    const drillVal = iso;
    const drillToDetailFilters = [
      { col: entity, op: '==', val: drillVal, formattedVal: drillVal },
    ];
    const drillByFilters = [{ col: entity, op: '==', val: drillVal }];

    onContextMenu(pointerEvent.clientX, pointerEvent.clientY, {
      drillToDetail: drillToDetailFilters,
      crossFilter: getCrossFilterDataMask(feature),
      drillBy: { filters: drillByFilters, groupbyFieldName: 'entity' },
    });
  };

  const selectAndDisplayNameOfRegion = feature => {
    let name = '';
    if (feature?.properties) {
      name = feature.properties.NAME_2 || feature.properties.NAME_1 || '';
    }
    bigText.text(name);
  };

  const updateMetrics = regionRows => {
    if (regionRows?.length > 0) resultText.text(format(regionRows[0].metric));
    else resultText.text('');
  };

  const mouseenter = function (d) {
    let c = colorFn(d);
    if (c && c !== 'none') c = d3.rgb(c).darker().toString();
    d3.select(this).style('fill', c);
    selectAndDisplayNameOfRegion(d);
    const result = data.filter(r => r.country_id === d?.properties?.ISO);
    updateMetrics(result);
  };

  const mouseout = function () {
    d3.select(this).style('fill', d => colorFn(d));
    bigText.text('');
    resultText.text('');
  };

  // Zoom with panning bounds
  const zoom = d3.behavior
    .zoom()
    .scaleExtent([1, 4])
    .on('zoom', () => {
      const { translate, scale } = d3.event; // [tx, ty]
      let [tx, ty] = translate;

      const scaledW = width * scale;
      const scaledH = height * scale;
      const minX = Math.min(0, width - scaledW);
      const maxX = 0;
      const minY = Math.min(0, height - scaledH);
      const maxY = 0;

      // clamp
      tx = Math.max(Math.min(tx, maxX), minX);
      ty = Math.max(Math.min(ty, maxY), minY);

      g.attr('transform', `translate(${tx}, ${ty}) scale(${scale})`);
      zoomStates[chartKey] = { scale, translate: [tx, ty] };
    });

  d3.select(svg.node()).call(zoom);

  // Restore
  if (zoomStates[chartKey]) {
    const { scale, translate } = zoomStates[chartKey];
    zoom.scale(scale).translate(translate);
    g.attr(
      'transform',
      `translate(${translate[0]}, ${translate[1]}) scale(${scale})`,
    );
  }

  // Visual highlighting for selected regions
  function highlightSelectedRegion() {
    const selectedValues = filterState.selectedValues?.length
      ? filterState.selectedValues
      : [];

    mapLayer
      .selectAll('path.region')
      .style('fill-opacity', d => {
        const iso = d?.properties?.ISO;
        return selectedValues.length === 0 || selectedValues.includes(iso)
          ? 1
          : 0.3;
      })
      .style('stroke', d => {
        const iso = d?.properties?.ISO;
        return selectedValues.includes(iso) ? '#222' : null;
      })
      .style('stroke-width', d => {
        const iso = d?.properties?.ISO;
        return selectedValues.includes(iso) ? '1.5px' : '0.5px';
      });
  }

  // Click handler
  const handleClick = feature => {
    if (!emitCrossFilters || typeof setDataMask !== 'function') return;
    const iso = feature?.properties?.ISO;
    if (!iso) return;

    const baseline = filterState.selectedValues || [];
    const currently = new Set(baseline);
    const shift = !!(d3.event && d3.event.shiftKey);

    if (shift) {
      if (currently.has(iso)) {
        currently.delete(iso);
      } else {
        currently.add(iso);
      }
    } else if (currently.size === 1 && currently.has(iso)) {
      currently.clear();
    } else {
      currently.clear();
      currently.add(iso);
    }

    const newSelection = Array.from(currently);

    setDataMask({
      extraFormData: {
        filters: newSelection.length
          ? [{ col: entity, op: 'IN', val: newSelection }]
          : [],
      },
      filterState: {
        value: newSelection.length ? newSelection : null,
        selectedValues: newSelection.length ? newSelection : null,
      },
    });

    highlightSelectedRegion();
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

    const bounds = path.bounds(mapData);
    const hscale = (scale * width) / (bounds[1][0] - bounds[0][0]);
    const vscale = (scale * height) / (bounds[1][1] - bounds[0][1]);
    const newScale = Math.min(hscale, vscale);

    projection.scale(newScale);
    const newBounds = path.bounds(mapData);
    projection.translate([
      width - (newBounds[0][0] + newBounds[1][0]) / 2,
      height - (newBounds[0][1] + newBounds[1][1]) / 2,
    ]);

    const sel = mapLayer.selectAll('path.region').data(features);

    sel
      .enter()
      .append('path')
      .attr('class', 'region')
      .attr('vector-effect', 'non-scaling-stroke')
      .attr('d', path)
      .style('fill', colorFn)
      .on('mouseenter', mouseenter)
      .on('mouseout', mouseout)
      .on('contextmenu', handleContextMenu)
      .on('click', handleClick);

    mapLayer.selectAll('path.region').attr('d', path).style('fill', colorFn);
    sel.exit().remove();

    highlightSelectedRegion();
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
