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
// Store zoom state per chart instance using element as key to enable garbage collection
const zoomStates = new WeakMap();

function CountryMap(element, props) {
  const {
    data,
    width,
    height,
    country,
    entity,
    linearColorScheme,
    numberFormat,
    colorScheme,
    sliceId,
    filterState,
    emitCrossFilters,
    onContextMenu,
    setDataMask,
  } = props;

  const container = element;
  const format = getNumberFormatter(numberFormat);

  const linearColorScale = getSequentialSchemeRegistry()
    .get(linearColorScheme)
    .createLinearScale(d3Extent(data, v => v.metric));

  const colorScale = CategoricalColorNamespace.getScale(colorScheme);

  const colorMap = {};
  data.forEach(d => {
    colorMap[d.country_id] = colorScheme
      ? colorScale(d.country_id, sliceId)
      : linearColorScale(d.metric);
  });

  const colorFn = feature => {
    if (!feature?.properties) return '#d9d9d9';
    const iso = feature.properties.ISO;
    return colorMap[iso] || '#d9d9d9';
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
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('cursor', 'grab');
  const backgroundRect = svg
    .append('rect')
    .attr('class', 'background')
    .attr('width', width)
    .attr('height', height);
  const g = svg.append('g');
  const mapLayer = g.append('g').classed('map-layer', true);
  // Add hover popup for tooltip
  const hoverPopup = div.append('div').attr('class', 'hover-popup');

  let centered;

  // Cross-filter support
  const getCrossFilterDataMask = source => {
    // Guard check for entity prop
    if (!entity) return undefined;

    const selected = filterState?.selectedValues || [];
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
    if (!iso || typeof onContextMenu !== 'function' || !entity) return;

    const drillVal = iso;
    const drillToDetailFilters = [
      { col: entity, op: '==', val: drillVal, formattedVal: drillVal },
    ];
    const drillByFilters = [{ col: entity, op: '==', val: drillVal }];

    onContextMenu(pointerEvent.clientX, pointerEvent.clientY, {
      drillToDetail: drillToDetailFilters,
      crossFilter: getCrossFilterDataMask(feature),
      drillBy: { filters: drillByFilters, groupbyFieldName: entity },
    });
  };

  // Helper to get region name
  const getNameOfRegion = function getNameOfRegion(feature) {
    if (feature && feature.properties) {
      if (feature.properties.ID_2) {
        return feature.properties.NAME_2;
      }
      return feature.properties.NAME_1;
    }
    return '';
  };

  // Mouse enter handler with tooltip
  const mouseenter = function mouseenter(d) {
    // Darken color
    let c = colorFn(d);
    if (c && c !== 'none') {
      c = d3.rgb(c).darker().toString();
    }
    d3.select(this).style('fill', c);

    // Display information popup
    const result = data.filter(r => r.country_id === d?.properties?.ISO);
    const position = d3.mouse(svg.node());
    hoverPopup
      .style('display', 'block')
      .style('top', `${position[1] + 30}px`)
      .style('left', `${position[0]}px`)
      .html(
        `<div><strong>${getNameOfRegion(d)}</strong><br>${result.length > 0 ? format(result[0].metric) : ''}</div>`,
      );
  };

  // Mouse move handler to update tooltip position
  const mousemove = function mousemove() {
    const position = d3.mouse(svg.node());
    hoverPopup
      .style('top', `${position[1] + 30}px`)
      .style('left', `${position[0]}px`);
  };

  // Mouse out handler
  const mouseout = function mouseout() {
    d3.select(this).style('fill', d => colorFn(d));
    hoverPopup.style('display', 'none');
  };

  // Zoom with panning bounds
  const zoom = d3.behavior
    .zoom()
    .scaleExtent([1, 4])
    .on('zoomstart', () => {
      svg.style('cursor', 'grabbing');
    })
    .on('zoom', () => {
      const { translate, scale } = d3.event;
      let [tx, ty] = translate;

      const scaledW = width * scale;
      const scaledH = height * scale;
      const minX = Math.min(0, width - scaledW);
      const maxX = 0;
      const minY = Math.min(0, height - scaledH);
      const maxY = 0;

      tx = Math.max(Math.min(tx, maxX), minX);
      ty = Math.max(Math.min(ty, maxY), minY);

      g.attr('transform', `translate(${tx}, ${ty}) scale(${scale})`);
      // Prevent redundant writes by updating zoomStates only when scale or translate values change
      const prev = zoomStates.get(element);
      const changed =
        !prev ||
        prev.scale !== scale ||
        prev.translate[0] !== tx ||
        prev.translate[1] !== ty;
      if (changed) {
        // Store zoom state using element as WeakMap key
        zoomStates.set(element, { scale, translate: [tx, ty] });
      }
    })
    .on('zoomend', () => {
      svg.style('cursor', 'grab');
    });

  d3.select(svg.node()).call(zoom);

  // Restore previous zoom state if it exists
  const savedZoom = zoomStates.get(element);
  if (savedZoom) {
    const { scale, translate } = savedZoom;
    zoom.scale(scale).translate(translate);
    g.attr(
      'transform',
      `translate(${translate[0]}, ${translate[1]}) scale(${scale})`,
    );
  }

  // Visual highlighting for selected regions
  function highlightSelectedRegion(selectedValues = null) {
    const selected = selectedValues || filterState?.selectedValues || [];

    mapLayer
      .selectAll('path.region')
      .style('fill-opacity', d => {
        const iso = d?.properties?.ISO;
        return selected.length === 0 || selected.includes(iso) ? 1 : 0.3;
      })
      .style('stroke', d => {
        const iso = d?.properties?.ISO;
        return selected.includes(iso) ? '#222' : null;
      })
      .style('stroke-width', d => {
        const iso = d?.properties?.ISO;
        return selected.includes(iso) ? '1.5px' : '0.5px';
      });
  }

  // Click handler for cross-filters
  const handleClick = feature => {
    // Guard checks for required props
    if (!entity || !emitCrossFilters || typeof setDataMask !== 'function') {
      return;
    }

    const iso = feature?.properties?.ISO;
    if (!iso) return;

    const selectedValues = filterState?.selectedValues || [];
    const isSelected = selectedValues.includes(iso);

    // Toggle selection: if already selected, clear; otherwise select this region
    const newSelection = isSelected ? [] : [iso];

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

    // Pass new selection directly to avoid stale state
    highlightSelectedRegion(newSelection.length ? newSelection : []);
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
      .attr('vector-effect', 'non-scaling-stroke');

    // Apply attributes and event handlers to all elements (enter + update)
    mapLayer
      .selectAll('path.region')
      .attr('d', path)
      .style('fill', colorFn)
      .on('mouseenter', mouseenter)
      .on('mousemove', mousemove)
      .on('mouseout', mouseout)
      .on('contextmenu', handleContextMenu)
      .on('click', handleClick);

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
