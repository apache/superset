/* eslint-disable camelcase */
import { QueryFormData } from './types/QueryFormData';
import { QueryObjectFilterClause } from './types/Query';
import { isSimpleAdhocFilter } from './types/Filter';
import convertFilter from './convertFilter';

/** Logic formerly in viz.py's process_query_filters */
export default function processFilters(formData: QueryFormData) {
  // Split adhoc_filters into four fields according to
  // (1) clause (WHERE or HAVING)
  // (2) expressionType
  //     2.1 SIMPLE (subject + operator + comparator)
  //     2.2 SQL (freeform SQL expression))
  const { adhoc_filters } = formData;
  if (Array.isArray(adhoc_filters)) {
    const simpleWhere: QueryObjectFilterClause[] = formData.filters || [];
    const simpleHaving: QueryObjectFilterClause[] = [];
    const freeformWhere: string[] = [];
    if (formData.where) freeformWhere.push(formData.where);
    const freeformHaving: string[] = [];

    adhoc_filters.forEach(filter => {
      const { clause } = filter;
      if (isSimpleAdhocFilter(filter)) {
        const filterClause = convertFilter(filter);
        if (clause === 'WHERE') {
          simpleWhere.push(filterClause);
        } else {
          simpleHaving.push(filterClause);
        }
      } else {
        const { sqlExpression } = filter;
        if (clause === 'WHERE') {
          freeformWhere.push(sqlExpression);
        } else {
          freeformHaving.push(sqlExpression);
        }
      }
    });

    // some filter-related fields need to go in `extras`
    const extras = {
      having: freeformHaving.map(exp => `(${exp})`).join(' AND '),
      having_druid: simpleHaving,
      where: freeformWhere.map(exp => `(${exp})`).join(' AND '),
      ...formData.extras,
    };

    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      filters: simpleWhere,
      extras,
    };
  }

  return {};
}
