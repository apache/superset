import { Registry } from '@superset-ui/core';
import { QueryContext } from '@superset-ui/query';
declare type BuildQuery = (formData: any) => QueryContext;
declare class ChartBuildQueryRegistry extends Registry<BuildQuery> {
    constructor();
}
declare const getInstance: () => ChartBuildQueryRegistry;
export default getInstance;
//# sourceMappingURL=ChartBuildQueryRegistrySingleton.d.ts.map