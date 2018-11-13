import Preset from '../core/models/Preset';
import ArcChartPlugin from '../deckgl/layers/Arc/ArcChartPlugin';
import GeoJsonChartPlugin from '../deckgl/layers/Geojson/GeojsonChartPlugin';
import GridChartPlugin from '../deckgl/layers/Grid/GridChartPlugin';
import HexChartPlugin from '../deckgl/layers/Hex/HexChartPlugin';
import MultiChartPlugin from '../deckgl/Multi/MultiChartPlugin';
import PathChartPlugin from '../deckgl/layers/Path/PathChartPlugin';
import PolygonChartPlugin from '../deckgl/layers/Polygon/PolygonChartPlugin';
import ScatterChartPlugin from '../deckgl/layers/Scatter/ScatterChartPlugin';
import ScreengridChartPlugin from '../deckgl/layers/Screengrid/ScreengridChartPlugin';

export default class DeckGLChartPreset extends Preset {
  constructor() {
    super({
      name: 'deck.gl charts',
      plugins: [
        new ArcChartPlugin().configure({ key: 'deck_arc' }),
        new GeoJsonChartPlugin().configure({ key: 'deck_geojson' }),
        new GridChartPlugin().configure({ key: 'deck_grid' }),
        new HexChartPlugin().configure({ key: 'deck_hex' }),
        new MultiChartPlugin().configure({ key: 'deck_multi' }),
        new PathChartPlugin().configure({ key: 'deck_path' }),
        new PolygonChartPlugin().configure({ key: 'deck_polygon' }),
        new ScatterChartPlugin().configure({ key: 'deck_scatter' }),
        new ScreengridChartPlugin().configure({ key: 'deck_screengrid' }),
      ],
    });
  }
}
