import Preset from '../core/models/Preset';
import CountryMapChartPlugin from '../CountryMap/CountryMapChartPlugin';
import MapBoxChartPlugin from '../MapBox/MapBoxChartPlugin';
import WorldMapChartPlugin from '../WorldMap/WorldMapChartPlugin';

export default class MapChartPreset extends Preset {
  constructor() {
    super({
      name: 'Maps',
      plugins: [
        new CountryMapChartPlugin().configure({ key: 'country_map' }),
        new MapBoxChartPlugin().configure({ key: 'mapbox' }),
        new WorldMapChartPlugin().configure({ key: 'world_map' }),
      ],
    });
  }
}
