import { Registry } from '@superset-ui/core';
import { ChartType } from '../models/ChartPlugin';
declare class ChartComponentRegistry extends Registry<ChartType> {
    constructor();
}
declare const getInstance: () => ChartComponentRegistry;
export default getInstance;
//# sourceMappingURL=ChartComponentRegistrySingleton.d.ts.map