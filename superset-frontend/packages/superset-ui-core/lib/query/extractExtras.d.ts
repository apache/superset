import { AppliedTimeExtras, QueryFormData, QueryObjectExtras, QueryObjectFilterClause } from './types';
declare type ExtraFilterQueryField = {
    time_range?: string;
    granularity_sqla?: string;
    time_grain_sqla?: string;
    druid_time_origin?: string;
    granularity?: string;
};
declare type ExtractedExtra = ExtraFilterQueryField & {
    filters: QueryObjectFilterClause[];
    extras: QueryObjectExtras;
    applied_time_extras: AppliedTimeExtras;
};
export default function extractExtras(formData: QueryFormData): ExtractedExtra;
export {};
//# sourceMappingURL=extractExtras.d.ts.map