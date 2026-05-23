import { buildQueryContext, QueryFormData } from '@superset-ui/core';


export default function buildQuery(formData: QueryFormData) {
    const filterColumn = (formData as any).filterColumn;
    const columns = filterColumn
        ? (Array.isArray(filterColumn) ? filterColumn : [filterColumn])
        : [];


    return buildQueryContext(formData, baseQueryObject => [
        {
            ...baseQueryObject,
            groupby: columns,
        },
    ]);
}
