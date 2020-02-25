import {
  UnaryOperator,
  BinaryOperator,
  SetOperator,
  isUnaryOperator,
  isBinaryOperator,
  isSetOperator,
} from './Operator';

interface BaseSimpleAdhocFilter {
  expressionType: 'SIMPLE';
  clause: 'WHERE' | 'HAVING';
  subject: string;
}

export type UnaryAdhocFilter = BaseSimpleAdhocFilter & {
  operator: UnaryOperator;
};

export type BinaryAdhocFilter = BaseSimpleAdhocFilter & {
  operator: BinaryOperator;
  comparator: string;
};

export type SetAdhocFilter = BaseSimpleAdhocFilter & {
  operator: SetOperator;
  comparator: string[];
};

export type SimpleAdhocFilter = UnaryAdhocFilter | BinaryAdhocFilter | SetAdhocFilter;

export interface FreeFormAdhocFilter {
  expressionType: 'SQL';
  clause: 'WHERE' | 'HAVING';
  sqlExpression: string;
}

export type AdhocFilter = SimpleAdhocFilter | FreeFormAdhocFilter;

//---------------------------------------------------
// Type guards
//---------------------------------------------------

export function isSimpleAdhocFilter(filter: AdhocFilter): filter is SimpleAdhocFilter {
  return filter.expressionType === 'SIMPLE';
}

export function isUnaryAdhocFilter(filter: SimpleAdhocFilter): filter is UnaryAdhocFilter {
  return isUnaryOperator(filter.operator);
}

export function isBinaryAdhocFilter(filter: SimpleAdhocFilter): filter is BinaryAdhocFilter {
  return isBinaryOperator(filter.operator);
}

export function isSetAdhocFilter(filter: SimpleAdhocFilter): filter is SetAdhocFilter {
  return isSetOperator(filter.operator);
}
