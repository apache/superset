import { Preset } from '@superset-ui/core';
import PartitionChartPlugin from '../Partition/PartitionChartPlugin';
import SunburstChartPlugin from '../Sunburst/SunburstChartPlugin';
import TreemapChartPlugin from '../Treemap/TreemapChartPlugin';

export default class HierarchyChartPreset extends Preset {
  constructor() {
    super({
      name: 'Hierarchy charts',
      plugins: [
        new PartitionChartPlugin().configure({ key: 'partition' }),
        new SunburstChartPlugin().configure({ key: 'sunburst' }),
        new TreemapChartPlugin().configure({ key: 'treemap' }),
      ],
    });
  }
}
