import { QueryObjectFilterClause } from '@superset-ui/core';

export const getSelectExtraFormData = (
  col: string,
  value?: undefined | null | string[] | number[],
  emptyFilter = false,
  inverseSelection = false,
) => ({
  append_form_data: emptyFilter
    ? {
        extras: {
          where: '1 = 0',
        },
      }
    : {
        filters:
          value === undefined || value === null || value.length === 0
            ? []
            : [
                {
                  col,
                  op: inverseSelection ? ('NOT IN' as const) : ('IN' as const),
                  val: value,
                },
              ],
      },
});

export const getRangeExtraFormData = (
  col: string,
  lower?: number,
  upper?: number,
) => {
  const filters: QueryObjectFilterClause[] = [];
  if (lower !== undefined && lower !== null) {
    filters.push({ col, op: '>=', val: lower });
  }
  if (upper !== undefined && upper !== null) {
    filters.push({ col, op: '>=', val: upper });
  }

  return {
    append_form_data: {
      filters,
    },
  };
};
