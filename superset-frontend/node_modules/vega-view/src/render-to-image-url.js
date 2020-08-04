import renderHeadless from './render-headless';
import {RenderType as Type} from 'vega-scenegraph';
import {error} from 'vega-util';

/**
 * Produce an image URL for the visualization. Depending on the type
 * parameter, the generated URL contains data for either a PNG or SVG image.
 * The URL can be used (for example) to download images of the visualization.
 * This method is asynchronous, returning a Promise instance.
 * @param {string} type - The image type. One of 'svg', 'png' or 'canvas'.
 *   The 'canvas' and 'png' types are synonyms for a PNG image.
 * @return {Promise} - A promise that resolves to an image URL.
 */
export default async function(type, scaleFactor) {
  if (type !== Type.Canvas && type !== Type.SVG && type !== Type.PNG) {
    error('Unrecognized image type: ' + type);
  }

  const r = await renderHeadless(this, type, scaleFactor);
  return type === Type.SVG
    ? toBlobURL(r.svg(), 'image/svg+xml')
    : r.canvas().toDataURL('image/png');
}

function toBlobURL(data, mime) {
  var blob = new Blob([data], {type: mime});
  return window.URL.createObjectURL(blob);
}
