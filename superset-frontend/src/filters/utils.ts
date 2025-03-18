// DODO was here
import {
  DataRecordValue,
  GenericDataType,
  NumberFormatter,
  QueryObjectFilterClause,
  TimeFormatter,
  ExtraFormData,
} from '@superset-ui/core';
import { FALSE_STRING, NULL_STRING, TRUE_STRING } from 'src/utils/common';
import { FilterPlugins } from 'src/constants'; // DODO added 44211759
import {
  Clauses,
  ExpressionTypes,
} from '../explore/components/controls/FilterControl/types';

export const getSelectExtraFormData = (
  col: string,
  value?: null | (string | number | boolean | null)[],
  emptyFilter = false,
  inverseSelection = false,
): ExtraFormData => {
  const extra: ExtraFormData = {};
  if (emptyFilter) {
    extra.adhoc_filters = [
      {
        expressionType: ExpressionTypes.Sql,
        clause: Clauses.Where,
        sqlExpression: '1 = 0',
      },
    ];
  } else if (value !== undefined && value !== null && value.length !== 0) {
    extra.filters = [
      {
        col,
        op: inverseSelection ? ('NOT IN' as const) : ('IN' as const),
        // @ts-ignore
        val: value,
      },
    ];
  }
  return extra;
};

export const getRangeExtraFormData = (
  col: string,
  lower?: number | null,
  upper?: number | null,
) => {
  const filters: QueryObjectFilterClause[] = [];
  if (lower !== undefined && lower !== null && lower !== upper) {
    filters.push({ col, op: '>=', val: lower });
  }
  if (upper !== undefined && upper !== null && upper !== lower) {
    filters.push({ col, op: '<=', val: upper });
  }
  if (
    upper !== undefined &&
    upper !== null &&
    lower !== undefined &&
    lower !== null &&
    upper === lower
  ) {
    filters.push({ col, op: '==', val: upper });
  }

  return filters.length
    ? {
        filters,
      }
    : {};
};

export interface DataRecordValueFormatter {
  (value: DataRecordValue, dtype: GenericDataType): string;
}

export function getDataRecordFormatter({
  timeFormatter,
  numberFormatter,
}: {
  timeFormatter?: TimeFormatter;
  numberFormatter?: NumberFormatter;
} = {}): DataRecordValueFormatter {
  return (value, dtype) => {
    if (value === null || value === undefined) {
      return NULL_STRING;
    }
    if (typeof value === 'boolean') {
      return value ? TRUE_STRING : FALSE_STRING;
    }
    if (dtype === GenericDataType.Boolean) {
      try {
        return JSON.parse(String(value).toLowerCase())
          ? TRUE_STRING
          : FALSE_STRING;
      } catch {
        return FALSE_STRING;
      }
    }
    if (typeof value === 'string') {
      return value;
    }
    if (timeFormatter && dtype === GenericDataType.Temporal) {
      return timeFormatter(value);
    }
    if (
      numberFormatter &&
      typeof value === 'number' &&
      dtype === GenericDataType.Numeric
    ) {
      return numberFormatter(value);
    }
    return String(value);
  };
}

// DODO added 44211759
export const hasFilterTranslations = (filterType: string): boolean =>
  filterType === FilterPlugins.SelectWithTranslation ||
  filterType === FilterPlugins.SelectByIdWithTranslation;
