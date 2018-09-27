import React from 'react';
import { fitBounds } from 'viewport-mercator-project';
import d3 from 'd3';

import sandboxedEval from '../../../modules/sandbox';

export function getBounds(points) {
  const latExt = d3.extent(points, d => d[1]);
  const lngExt = d3.extent(points, d => d[0]);
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

export function commonLayerProps(formData, slice) {
  const fd = formData;
  let onHover;
  let tooltipContentGenerator;
  if (fd.js_tooltip) {
    tooltipContentGenerator = sandboxedEval(fd.js_tooltip);
  } else if (fd.line_column && fd.line_type === 'geohash') {
    tooltipContentGenerator = o => (
      <div>
        <div>{fd.line_column}: <strong>{o.object[fd.line_column]}</strong></div>
        {fd.metric &&
          <div>{fd.metric}: <strong>{o.object[fd.metric]}</strong></div>}
      </div>);
  }
  if (tooltipContentGenerator) {
    onHover = (o) => {
      if (o.picked) {
        slice.setTooltip({
          content: tooltipContentGenerator(o),
          x: o.x,
          y: o.y,
        });
      } else {
        slice.setTooltip(null);
      }
    };
  }
  let onClick;
  if (fd.js_onclick_href) {
    onClick = (o) => {
      const href = sandboxedEval(fd.js_onclick_href)(o);
      window.open(href);
    };
  } else if (fd.table_filter && fd.line_type === 'geohash') {
    onClick = o => slice.addFilter(fd.line_column, [o.object[fd.line_column]], false);
  }
  return {
    onClick,
    onHover,
    pickable: Boolean(onHover),
  };
}
