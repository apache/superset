import {context} from './canvas/context';
import {isArray, lruCache} from 'vega-util';

// memoize text width measurement
const widthCache = lruCache();

export var textMetrics = {
  height: fontSize,
  measureWidth: measureWidth,
  estimateWidth: estimateWidth,
  width: estimateWidth,
  canvas: useCanvas
};

useCanvas(true);

function useCanvas(use) {
  textMetrics.width = (use && context) ? measureWidth : estimateWidth;
}

// make dumb, simple estimate if no canvas is available
function estimateWidth(item, text) {
  return _estimateWidth(textValue(item, text), fontSize(item));
}

function _estimateWidth(text, currentFontHeight) {
  return ~~(0.8 * text.length * currentFontHeight);
}

// measure text width if canvas is available
function measureWidth(item, text) {
  return fontSize(item) <= 0 || !(text = textValue(item, text)) ? 0
    : _measureWidth(text, font(item));
}

function _measureWidth(text, currentFont) {
  const key = `(${currentFont}) ${text}`;
  let width = widthCache.get(key);
  if (width === undefined) {
    context.font = currentFont;
    width = context.measureText(text).width;
    widthCache.set(key, width);
  }
  return width;
}

export function fontSize(item) {
  return item.fontSize != null ? (+item.fontSize || 0) : 11;
}

export function lineHeight(item) {
  return item.lineHeight != null ? item.lineHeight : (fontSize(item) + 2);
}

function lineArray(_) {
  return isArray(_) ? _.length > 1 ? _ : _[0] : _;
}

export function textLines(item) {
  return lineArray(
    item.lineBreak && item.text && !isArray(item.text)
      ? item.text.split(item.lineBreak)
      : item.text
  );
}

export function multiLineOffset(item) {
  const tl = textLines(item);
  return (isArray(tl) ? (tl.length - 1) : 0) * lineHeight(item);
}

export function textValue(item, line) {
  const text = line == null ? '' : (line + '').trim();
  return item.limit > 0 && text.length ? truncate(item, text) : text;
}

function widthGetter(item) {
  if (textMetrics.width === measureWidth) {
    // we are using canvas
    const currentFont = font(item);
    return text => _measureWidth(text, currentFont);
  } else {
    // we are relying on estimates
    const currentFontHeight = fontSize(item);
    return text => _estimateWidth(text, currentFontHeight);
  }
}

function truncate(item, text) {
  var limit = +item.limit,
      width = widthGetter(item);

  if (width(text) < limit) return text;

  var ellipsis = item.ellipsis || '\u2026',
      rtl = item.dir === 'rtl',
      lo = 0,
      hi = text.length, mid;

  limit -= width(ellipsis);

  if (rtl) {
    while (lo < hi) {
      mid = (lo + hi >>> 1);
      if (width(text.slice(mid)) > limit) lo = mid + 1;
      else hi = mid;
    }
    return ellipsis + text.slice(lo);
  } else {
    while (lo < hi) {
      mid = 1 + (lo + hi >>> 1);
      if (width(text.slice(0, mid)) < limit) lo = mid;
      else hi = mid - 1;
    }
    return text.slice(0, lo) + ellipsis;
  }
}

export function fontFamily(item, quote) {
  var font = item.font;
  return (quote && font
    ? String(font).replace(/"/g, '\'')
    : font) || 'sans-serif';
}

export function font(item, quote) {
  return '' +
    (item.fontStyle ? item.fontStyle + ' ' : '') +
    (item.fontVariant ? item.fontVariant + ' ' : '') +
    (item.fontWeight ? item.fontWeight + ' ' : '') +
    fontSize(item) + 'px ' +
    fontFamily(item, quote);
}

export function offset(item) {
  // perform our own font baseline calculation
  // why? not all browsers support SVG 1.1 'alignment-baseline' :(
  // this also ensures consistent layout across renderers
  var baseline = item.baseline,
      h = fontSize(item);

  return Math.round(
    baseline === 'top'         ?  0.79 * h :
    baseline === 'middle'      ?  0.30 * h :
    baseline === 'bottom'      ? -0.21 * h :
    baseline === 'line-top'    ?  0.29 * h + 0.5 * lineHeight(item) :
    baseline === 'line-bottom' ?  0.29 * h - 0.5 * lineHeight(item) : 0
  );
}
