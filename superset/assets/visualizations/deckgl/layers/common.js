import dompurify from 'dompurify';
import sandboxedEval from '../../../javascripts/modules/sandbox';

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
