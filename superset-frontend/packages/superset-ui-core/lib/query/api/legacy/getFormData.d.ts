import { BaseParams } from '../types';
import { QueryFormData } from '../../types/QueryFormData';
export interface Params extends BaseParams {
    sliceId: number;
    overrideFormData?: Partial<QueryFormData>;
}
export default function getFormData({ client, sliceId, overrideFormData, requestConfig, }: Params): Promise<import("../../types/QueryFormData").DruidFormData | import("../../types/QueryFormData").SqlaFormData>;
//# sourceMappingURL=getFormData.d.ts.map