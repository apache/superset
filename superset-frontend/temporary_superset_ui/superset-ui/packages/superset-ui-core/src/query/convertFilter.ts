import { SimpleAdhocFilter, isBinaryAdhocFilter, isUnaryAdhocFilter } from './types/Filter';
import { QueryObjectFilterClause } from './types/Query';

export default function convertFilter(filter: SimpleAdhocFilter): QueryObjectFilterClause {
  const { subject } = filter;
  if (isUnaryAdhocFilter(filter)) {
    const { operator } = filter;

    return {
      col: subject,
      op: operator,
    };
  }
  if (isBinaryAdhocFilter(filter)) {
    const { operator } = filter;

    return {
      col: subject,
      op: operator,
      val: filter.comparator,
    };
  }

  const { operator } = filter;

  return {
    col: subject,
    op: operator,
    val: filter.comparator,
  };
}
