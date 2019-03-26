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
import React from 'react';

import { fitBounds } from 'viewport-mercator-project';
import * as d3array from 'd3-array';
import sandboxedEval from '../../../modules/sandbox';

export function getBounds(points) {
  const latExt = d3array.extent(points, d => d[1]);
  const lngExt = d3array.extent(points, d => d[0]);
  return [
    [lngExt[0], latExt[0]],
    [lngExt[1], latExt[1]],
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

export function commonLayerProps(formData, setTooltip, onSelect) {
  const fd = formData;
  let onHover;
  let tooltipContentGenerator;
  if (fd.jsTooltip) {
    tooltipContentGenerator = sandboxedEval(fd.jsTooltip);
  } else if (fd.lineColumn && fd.metric && ['geohash', 'zipcode'].indexOf(fd.lineType) >= 0) {
    const metricLabel = fd.metric.label || fd.metric;
    tooltipContentGenerator = o => (
      <div>
        <div>{fd.lineColumn}: <strong>{o.object[fd.lineColumn]}</strong></div>
        {fd.metric &&
          <div>{metricLabel}: <strong>{o.object[metricLabel]}</strong></div>}
      </div>);
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
  if (fd.jsOnclickHref) {
    onClick = (o) => {
      const href = sandboxedEval(fd.jsOnclickHref)(o);
      window.open(href);
    };
  } else if (fd.tableFilter && onSelect !== undefined) {
    onClick = o => onSelect(o.object[fd.lineColumn]);
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
