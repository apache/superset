import { ChartFormData } from '../types/ChartFormData';
import { QueryObjectFilterClause } from '../types/Query';
import { isSimpleAdhocFilter } from '../types/Filter';
import convertFilter from './convertFilter';

/** Logic formerly in viz.py's process_query_filters */
export default function processFilters(formData: ChartFormData) {
  // TODO: Implement
  // utils.convert_legacy_filters_into_adhoc(self.form_data)

  // TODO: Implement
  // merge_extra_filters(self.form_data)

  // Split adhoc_filters into four fields according to
  // (1) clause (WHERE or HAVING)
  // (2) expressionType
  //     2.1 SIMPLE (subject + operator + comparator)
  //     2.2 SQL (freeform SQL expression))

  // eslint-disable-next-line camelcase
  const { adhoc_filters } = formData;
  if (Array.isArray(adhoc_filters)) {
    const simpleWhere: QueryObjectFilterClause[] = [];
    const simpleHaving: QueryObjectFilterClause[] = [];
    const freeformWhere: string[] = [];
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

    return {
      filters: simpleWhere,
      having: freeformHaving.map(exp => `(${exp})`).join(' AND '),
      having_filters: simpleHaving,
      where: freeformWhere.map(exp => `(${exp})`).join(' AND '),
    };
  }

  return {};
}
