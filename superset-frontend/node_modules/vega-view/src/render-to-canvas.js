import renderHeadless from './render-headless';
import {RenderType} from 'vega-scenegraph';

/**
 * Produce a Canvas instance containing a rendered visualization.
 * This method is asynchronous, returning a Promise instance.
 * @return {Promise} - A promise that resolves to a Canvas instance.
 */
export default async function(scaleFactor, opt) {
  const r = await renderHeadless(this, RenderType.Canvas, scaleFactor, opt);
  return r.canvas();
}
