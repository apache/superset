import { isPhysicalColumn, QueryFormColumn } from './types';

export default function getColumnLabel(column: QueryFormColumn): string {
  if (isPhysicalColumn(column)) {
    return column;
  }
  if (column.label) {
    return column.label;
  }
  return column.sqlExpression;
}
