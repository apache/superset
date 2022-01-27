import { Registry } from '../..';
import { ChartType } from '../models/ChartPlugin';
declare class ChartComponentRegistry extends Registry<ChartType> {
    constructor();
}
declare const getInstance: () => ChartComponentRegistry;
export default getInstance;
//# sourceMappingURL=ChartComponentRegistrySingleton.d.ts.map