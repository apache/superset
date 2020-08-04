import initializeRenderer from './initialize-renderer';
import {renderModule} from 'vega-scenegraph';
import {error} from 'vega-util';

/**
 * Render the current scene in a headless fashion.
 * This method is asynchronous, returning a Promise instance.
 * @return {Promise} - A Promise that resolves to a renderer.
 */
export default async function(view, type, scaleFactor, opt) {
  const module = renderModule(type),
        ctr = module && module.headless;

  if (!ctr) error('Unrecognized renderer type: ' + type);

  await view.runAsync();
  return initializeRenderer(view, null, null, ctr, scaleFactor, opt)
    .renderAsync(view._scenegraph.root);
}
