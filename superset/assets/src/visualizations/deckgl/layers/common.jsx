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
import { fitBounds } from 'viewport-mercator-project';
import * as d3array from 'd3-array';
import sandboxedEval from '../../../modules/sandbox';

const PADDING = 0.25;
const GEO_BOUNDS = {
  LAT_MIN: -90,
  LAT_MAX: 90,
  LNG_MIN: -180,
  LNG_MAX: 180,
};

/**
 * Get the latitude bounds if latitude is a single coordinate
 * @param latExt Latitude range
 */
function getLatBoundsForSingleCoordinate(latExt) {
  const latMin = latExt[0] - PADDING < GEO_BOUNDS.LAT_MIN
    ? GEO_BOUNDS.LAT_MIN
    : latExt[0] - PADDING;
  const latMax = latExt[1] + PADDING > GEO_BOUNDS.LAT_MAX
    ? GEO_BOUNDS.LAT_MAX
    : latExt[1] + PADDING;
  return [latMin, latMax];
}

/**
 * Get the longitude bounds if longitude is a single coordinate
 * @param lngExt Longitude range
 */
function getLngBoundsForSingleCoordinate(lngExt) {
  const lngMin = lngExt[0] - PADDING < GEO_BOUNDS.LNG_MIN
    ? GEO_BOUNDS.LNG_MIN
    : lngExt[0] - PADDING;
  const lngMax = lngExt[1] + PADDING > GEO_BOUNDS.LNG_MAX
    ? GEO_BOUNDS.LNG_MAX
    : lngExt[1] + PADDING;
  return [lngMin, lngMax];
}

export function getBounds(points) {
  const latExt = d3array.extent(points, d => d[1]);
  const lngExt = d3array.extent(points, d => d[0]);
  const latBounds = latExt[0] === latExt[1] ? getLatBoundsForSingleCoordinate(latExt) : latExt;
  const lngBounds = lngExt[0] === lngExt[1] ? getLngBoundsForSingleCoordinate(lngExt) : lngExt;
  return [
    [lngBounds[0], latBounds[0]],
    [lngBounds[1], latBounds[1]],
  ];
}

export function fitViewport(viewport, points, padding = 10) {
  try {
    const bounds = getBounds(points);
    return {
      ...viewport,
      ...fitBounds({
        height: viewport.height,
        width: viewport.width,
        padding,
        bounds,
      }),
    };
  } catch (e) {
    /* eslint no-console: 0 */
    console.error('Could not auto zoom', e);
    return viewport;
  }
}

export function commonLayerProps(formData, setTooltip, setTooltipContent, onSelect) {
  const fd = formData;
  let onHover;
  let tooltipContentGenerator = setTooltipContent;
  if (fd.js_tooltip) {
    tooltipContentGenerator = sandboxedEval(fd.js_tooltip);
  }
  if (tooltipContentGenerator) {
    onHover = (o) => {
      if (o.picked) {
        setTooltip({
          content: tooltipContentGenerator(o),
          x: o.x,
          y: o.y + 30,
        });
      } else {
        setTooltip(null);
      }
    };
  }
  let onClick;
  if (fd.js_onclick_href) {
    onClick = (o) => {
      const href = sandboxedEval(fd.js_onclick_href)(o);
      window.open(href);
    };
  } else if (fd.table_filter && onSelect !== undefined) {
    onClick = o => onSelect(o.object[fd.line_column]);
  }
  return {
    onClick,
    onHover,
    pickable: Boolean(onHover),
  };
}

const percentiles = {
  p1: 0.01,
  p5: 0.05,
  p95: 0.95,
  p99: 0.99,
};

/* Get an a stat function that operates on arrays, aligns with control=js_agg_function  */
export function getAggFunc(type = 'sum', accessor = null) {
  if (type === 'count') {
    return arr => arr.length;
  }
  let d3func;
  if (type in percentiles) {
    d3func = (arr, acc) => {
      let sortedArr;
      if (accessor) {
        sortedArr = arr.sort((o1, o2) => d3array.ascending(accessor(o1), accessor(o2)));
      } else {
        sortedArr = arr.sort(d3array.ascending);
      }
      return d3array.quantile(sortedArr, percentiles[type], acc);
    };
  } else {
    d3func = d3array[type];
  }
  if (!accessor) {
    return arr => d3func(arr);
  }
  return arr => d3func(arr.map(accessor));
}
