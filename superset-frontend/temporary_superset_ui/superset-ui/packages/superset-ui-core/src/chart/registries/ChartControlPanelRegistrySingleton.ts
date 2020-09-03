import { Registry, makeSingleton } from '../..';
import { ChartControlPanel } from '../models/ChartControlPanel';

class ChartControlPanelRegistry extends Registry<ChartControlPanel, ChartControlPanel> {
  constructor() {
    super({ name: 'ChartControlPanel' });
  }
}

const getInstance = makeSingleton(ChartControlPanelRegistry);

export default getInstance;
