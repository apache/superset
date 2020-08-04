import { Registry } from '@superset-ui/core';
import { ChartControlPanel } from '../models/ChartControlPanel';
declare class ChartControlPanelRegistry extends Registry<ChartControlPanel, ChartControlPanel> {
    constructor();
}
declare const getInstance: () => ChartControlPanelRegistry;
export default getInstance;
//# sourceMappingURL=ChartControlPanelRegistrySingleton.d.ts.map