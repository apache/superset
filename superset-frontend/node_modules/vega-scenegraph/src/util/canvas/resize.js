function devicePixelRatio() {
  return typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
}

var pixelRatio = devicePixelRatio();

export default function(canvas, width, height, origin, scaleFactor, opt) {
  const inDOM = typeof HTMLElement !== 'undefined'
              && canvas instanceof HTMLElement
              && canvas.parentNode != null,
        context = canvas.getContext('2d'),
        ratio = inDOM ? pixelRatio : scaleFactor;

  canvas.width = width * ratio;
  canvas.height = height * ratio;

  for (const key in opt) {
    context[key] = opt[key];
  }

  if (inDOM && ratio !== 1) {
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
  }

  context.pixelRatio = ratio;
  context.setTransform(
    ratio, 0, 0, ratio,
    ratio * origin[0],
    ratio * origin[1]
  );

  return canvas;
}
