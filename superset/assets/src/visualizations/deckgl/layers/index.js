/* eslint camelcase: 0 */
import { getLayer as deck_grid } from './grid';
import { getLayer as deck_screengrid } from './screengrid';
import { getLayer as deck_path } from './path';
import { getLayer as deck_hex } from './hex';
import { getLayer as deck_scatter } from './scatter';
import { getLayer as deck_geojson } from './geojson';
import { getLayer as deck_arc } from './arc';
import { getLayer as deck_polygon } from './polygon';

const layerGenerators = {
  deck_grid,
  deck_screengrid,
  deck_path,
  deck_hex,
  deck_scatter,
  deck_geojson,
  deck_arc,
  deck_polygon,
};

export default layerGenerators;
