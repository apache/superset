import renderHeadless from './render-headless';
import {RenderType} from 'vega-scenegraph';

/**
 * Produce a rendered SVG string of the visualization.
 * This method is asynchronous, returning a Promise instance.
 * @return {Promise} - A promise that resolves to an SVG string.
 */
export default async function(scaleFactor) {
  const r = await renderHeadless(this, RenderType.SVG, scaleFactor);
  return r.svg();
}
