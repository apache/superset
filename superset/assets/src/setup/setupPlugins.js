import LegacyChartPreset from '../visualizations/presets/LegacyChartPreset';

export default function setupPlugins() {
  new LegacyChartPreset().register();
}
