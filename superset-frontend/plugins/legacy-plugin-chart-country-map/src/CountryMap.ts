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
  ValueFormatter,
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
  numberFormat?: string; // left for backward compatibility
  formatter: ValueFormatter;
  colorScheme: string;
  sliceId: number;
  onContextMenu?: (clientX: number, clientY: number, data: any) => void;
  emitCrossFilters?: boolean;
  setDataMask?: (dataMask: any) => void;
  filterState?: {
    selectedValues?: string[];
    extraFormData?: {
      filters?: any[];
    };
  };
  entity?: string;
}

const maps: Record<string, GeoData> = {};
// Store zoom state per chart instance using element as key to enable garbage collection
const zoomStates = new WeakMap<HTMLElement, { scale: number; translate: [number, number] }>();

function CountryMap(element: HTMLElement, props: CountryMapProps) {
  const {
    data,
    width,
    height,
    country,
    entity,
    linearColorScheme,
    formatter,
    colorScheme,
    sliceId,
    filterState,
    emitCrossFilters,
    onContextMenu,
    setDataMask,
  } = props;

  const container = element;
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

  const colorFn = (feature: GeoFeature) => {
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

  // Track mouse position to distinguish clicks from drags
  let mousedownPos: { x: number; y: number } | null = null;

  // Cross-filter support
  const getCrossFilterDataMask = (source: GeoFeature) => {
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
  const handleContextMenu = (feature: GeoFeature) => {
    const pointerEvent = d3.event;

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
        `<div><strong>${getNameOfRegion(d)}</strong><br>${result.length > 0 ? formatter(result[0].metric) : ''}</div>`,
      );
  };

  // Mouse move handler to update tooltip position
  const mousemove = function mousemove() {
    const position = d3.mouse(svg.node());
    hoverPopup
      .style('top', `${position[1] + 30}px`)
      .style('left', `${position[0]}px`);
  };

  const mouseout = function mouseout(this: SVGPathElement) {
    d3.select(this).style('fill', (d: GeoFeature) => colorFn(d));
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
      const prev = zoomStates.get(element);
      const changed =
        !prev ||
        prev.scale !== scale ||
        prev.translate[0] !== tx ||
        prev.translate[1] !== ty;
      if (changed) {
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
  function highlightSelectedRegion(selectedValues: string[] | null = null) {
    const selected = selectedValues || filterState?.selectedValues || [];

    mapLayer
      .selectAll('path.region')
      .style('fill-opacity', (d: GeoFeature) => {
        const iso = d?.properties?.ISO;
        return selected.length === 0 || selected.includes(iso) ? 1 : 0.3;
      })
      .style('stroke', (d: GeoFeature) => {
        const iso = d?.properties?.ISO;
        return selected.includes(iso) ? '#222' : null;
      })
      .style('stroke-width', (d: GeoFeature) => {
        const iso = d?.properties?.ISO;
        return selected.includes(iso) ? '1.5px' : '0.5px';
      });
  }

  // Click handler for cross-filters
  const handleClick = (feature: GeoFeature) => {
    if (!entity || !emitCrossFilters || typeof setDataMask !== 'function') {
      return;
    }

    const iso = feature?.properties?.ISO;
    if (!iso) return;

    const selectedValues = filterState?.selectedValues || [];
    const isSelected = selectedValues.includes(iso);

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

    highlightSelectedRegion(newSelection.length ? newSelection : []);
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
      .on('mousedown', function mousedown() {
        const pos = d3.mouse(svg.node());
        mousedownPos = { x: pos[0], y: pos[1] };
      })
      .on('click', function click(feature: GeoFeature) {
        if (mousedownPos) {
          const pos = d3.mouse(svg.node());
          const dx = Math.abs(pos[0] - mousedownPos.x);
          const dy = Math.abs(pos[1] - mousedownPos.y);
          const dragThreshold = 5;

          if (dx < dragThreshold && dy < dragThreshold) {
            handleClick(feature);
          }

          mousedownPos = null;
        }
      });

    sel.exit().remove();

    highlightSelectedRegion();
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
