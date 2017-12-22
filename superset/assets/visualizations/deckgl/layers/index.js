/* eslint camelcase: 0 */
import deck_grid from './grid';
import deck_screengrid from './screengrid';
import deck_path from './path';
import deck_hex from './hex';
import deck_scatter from './scatter';
import deck_geojson from './geojson';

const layerGenerators = {
  deck_grid,
  deck_screengrid,
  deck_path,
  deck_hex,
  deck_scatter,
  deck_geojson,
};
export default layerGenerators;
