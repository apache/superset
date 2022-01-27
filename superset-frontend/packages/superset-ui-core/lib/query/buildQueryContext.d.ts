import { QueryFieldAliases, QueryFormData } from './types/QueryFormData';
import { QueryContext, QueryObject } from './types/Query';
import { SetDataMaskHook } from '../chart';
import { JsonObject } from '../connection';
export declare type BuildFinalQueryObjects = (baseQueryObject: QueryObject) => QueryObject[];
export default function buildQueryContext(formData: QueryFormData, options?: {
    buildQuery?: BuildFinalQueryObjects;
    queryFields?: QueryFieldAliases;
    ownState?: JsonObject;
    hooks?: {
        setDataMask: SetDataMaskHook;
    };
} | BuildFinalQueryObjects): QueryContext;
//# sourceMappingURL=buildQueryContext.d.ts.map