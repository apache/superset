export function transformFilters(
  filters: { subject: string; operator: string; comparator: string }[],
) {
  return filters.map(filter => {
    return {
      col: filter.subject,
      op: filter.operator,
      val: filter.comparator,
    };
  });
}
