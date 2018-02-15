import dompurify from 'dompurify';
import { fitBounds } from 'viewport-mercator-project';

import sandboxedEval from '../../../javascripts/modules/sandbox';

export function getBounds(points) {
  const latExt = d3.extent(points, d => d[1]);
  const lngExt = d3.extent(points, d => d[0]);
  return [
    [lngExt[0], latExt[0]],
    [lngExt[1], latExt[1]],
  ];
}

export function fitViewport(viewport, points, padding = 10) {
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
}

export function commonLayerProps(formData, slice) {
  const fd = formData;
  let onHover;
  if (fd.js_tooltip) {
    const jsTooltip = sandboxedEval(fd.js_tooltip);
    onHover = (o) => {
      if (o.picked) {
        slice.setTooltip({
          content: dompurify.sanitize(jsTooltip(o)),
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
  }
  return {
    onClick,
    onHover,
    pickable: Boolean(onHover),
  };
}
