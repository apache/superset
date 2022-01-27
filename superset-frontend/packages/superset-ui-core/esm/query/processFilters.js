(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;};





















import { isSimpleAdhocFilter } from './types/Filter';
import convertFilter from './convertFilter';

/** Logic formerly in viz.py's process_query_filters */
export default function processFilters(
formData)
{
  // Split adhoc_filters into four fields according to
  // (1) clause (WHERE or HAVING)
  // (2) expressionType
  //     2.1 SIMPLE (subject + operator + comparator)
  //     2.2 SQL (freeform SQL expression))
  const { adhoc_filters, extras = {}, filters = [], where } = formData;
  const simpleWhere = filters;

  const simpleHaving = [];
  const freeformWhere = [];
  if (where) freeformWhere.push(where);
  const freeformHaving = [];

  (adhoc_filters || []).forEach((filter) => {
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
  extras.having = freeformHaving.map((exp) => `(${exp})`).join(' AND ');
  extras.having_druid = simpleHaving;
  extras.where = freeformWhere.map((exp) => `(${exp})`).join(' AND ');

  return {
    filters: simpleWhere,
    extras };

};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(processFilters, "processFilters", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/query/processFilters.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();