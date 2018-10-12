/* eslint camelcase: 0 */
import { getLayer as deck_grid } from './Grid/Grid';
import { getLayer as deck_screengrid } from './Screengrid/Screengrid';
import { getLayer as deck_path } from './Path/Path';
import { getLayer as deck_hex } from './Hex/Hex';
import { getLayer as deck_scatter } from './Scatter/Scatter';
import { getLayer as deck_geojson } from './Geojson/Geojson';
import { getLayer as deck_arc } from './Arc/Arc';
import { getLayer as deck_polygon } from './Polygon/Polygon';

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
