import { Method, Endpoint } from '../../../connection';
import { QueryFormData } from '../../types/QueryFormData';
import { LegacyChartDataResponse } from './types';
import { BaseParams } from '../types';
export interface Params extends BaseParams {
    method?: Method;
    endpoint?: Endpoint;
    formData: QueryFormData;
}
export default function fetchExploreJson({ client, method, requestConfig, endpoint, formData, }: Params): Promise<LegacyChartDataResponse>;
//# sourceMappingURL=fetchExploreJson.d.ts.map