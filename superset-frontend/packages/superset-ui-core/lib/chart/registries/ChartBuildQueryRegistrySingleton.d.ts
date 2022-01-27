import { Registry, QueryContext, SetDataMaskHook, JsonObject } from '../..';
export declare type BuildQuery<T = any> = (formData: T, options?: {
    extras?: {
        cachedChanges?: any;
    };
    ownState?: JsonObject;
    hooks?: {
        setDataMask: SetDataMaskHook;
        setCachedChanges: (newChanges: any) => void;
    };
}) => QueryContext;
declare class ChartBuildQueryRegistry extends Registry<BuildQuery> {
    constructor();
}
declare const getInstance: () => ChartBuildQueryRegistry;
export default getInstance;
//# sourceMappingURL=ChartBuildQueryRegistrySingleton.d.ts.map