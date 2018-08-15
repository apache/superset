const SVG_NS = 'http://www.w3.org/2000/svg';

function isDefined(x) {
  return x !== null && x !== undefined;
}

export function getTextDimension({
  text,
  className,
  style,
  container = document.body,
}) {
  const textNode = document.createElementNS(SVG_NS, 'text');
  textNode.textContent = text;

  if (isDefined(className)) {
    textNode.setAttribute('class', className);
  }

  if (isDefined(style)) {
    ['font', 'fontWeight', 'fontStyle', 'fontSize', 'fontFamily', 'letterSpacing']
      .filter(field => isDefined(style[field]))
      .forEach((field) => {
        textNode.style[field] = style[field];
      });
  }

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.style.position = 'absolute'; // so it won't disrupt page layout
  svg.style.opacity = 0;           // and not visible
  svg.appendChild(textNode);
  container.appendChild(svg);
  let result;
  if (textNode.getBBox) {
    const bbox = textNode.getBBox();
    // round up
    result = {
      width: Math.ceil(bbox.width),
      height: Math.ceil(bbox.height),
    };
  } else {
    // Handle when called from non-browser and do not support getBBox()
    result = {
      width: 100,
      height: 100,
    };
  }
  container.removeChild(svg);
  return result;
}

/**
 * Shim to support legacy calls
 */
export function getTextWidth(text, font = '12px Roboto') {
  return getTextDimension({ text, style: { font } }).width;
}

export function computeMaxFontSize({
  text,
  idealFontSize,
  maxWidth,
  maxHeight,
  className,
  style,
  container,
}) {
  let size = idealFontSize;
  if (!isDefined(idealFontSize)) {
    if (isDefined(maxHeight)) {
      size = Math.floor(maxHeight);
    } else {
      throw new Error('You must specify at least one of maxHeight or idealFontSize');
    }
  }

  function computeDimension(fontSize) {
    return getTextDimension({
      text,
      className,
      style: { ...style, fontSize },
      container,
    });
  }

  let textDimension = computeDimension(size);

  // Decrease size until textWidth is less than maxWidth
  if (isDefined(maxWidth)) {
    while (textDimension.width > maxWidth) {
      size -= 2;
      textDimension = computeDimension(size);
    }
  }

  // Decrease size until textHeight is less than maxHeight
  if (isDefined(maxHeight)) {
    while (textDimension.height > maxHeight) {
      size -= 2;
      textDimension = computeDimension(size);
    }
  }

  return size;
}
