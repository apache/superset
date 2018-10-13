import Preset from '../core/models/Preset';
import ClassicChartPreset from './ClassicChartPreset';
import MapChartPreset from './MapChartPlugin';
import UncommonChartPreset from './UncommonChartPreset';

export default class LegacyChartPreset extends Preset {
  constructor() {
    super({
      name: 'Legacy charts',
      presets: [
        new ClassicChartPreset(),
        new MapChartPreset(),
        new UncommonChartPreset(),
      ],
    });
  }
}
