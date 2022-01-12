export function transformFilters(
  filters: { subject: string; operator: string; comparator: string }[],
) {
  return filters.map(filter => ({
    col: filter.subject,
    op: filter.operator,
    val: filter.comparator,
  }));
}
