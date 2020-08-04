export type LogicalComposition<T> = LogicalNot<T> | LogicalAnd<T> | LogicalOr<T> | T;

export interface LogicalOr<T> {
  or: LogicalComposition<T>[];
}

export interface LogicalAnd<T> {
  and: LogicalComposition<T>[];
}

export interface LogicalNot<T> {
  not: LogicalComposition<T>;
}

export function isLogicalOr(op: LogicalComposition<any>): op is LogicalOr<any> {
  return !!op.or;
}

export function isLogicalAnd(op: LogicalComposition<any>): op is LogicalAnd<any> {
  return !!op.and;
}

export function isLogicalNot(op: LogicalComposition<any>): op is LogicalNot<any> {
  return !!op.not;
}

export function forEachLeaf<T>(op: LogicalComposition<T>, fn: (op: T) => void) {
  if (isLogicalNot(op)) {
    forEachLeaf(op.not, fn);
  } else if (isLogicalAnd(op)) {
    for (const subop of op.and) {
      forEachLeaf(subop, fn);
    }
  } else if (isLogicalOr(op)) {
    for (const subop of op.or) {
      forEachLeaf(subop, fn);
    }
  } else {
    fn(op);
  }
}

export function normalizeLogicalComposition<T>(
  op: LogicalComposition<T>,
  normalizer: (o: T) => T
): LogicalComposition<T> {
  if (isLogicalNot(op)) {
    return {not: normalizeLogicalComposition(op.not, normalizer)};
  } else if (isLogicalAnd(op)) {
    return {and: op.and.map(o => normalizeLogicalComposition(o, normalizer))};
  } else if (isLogicalOr(op)) {
    return {or: op.or.map(o => normalizeLogicalComposition(o, normalizer))};
  } else {
    return normalizer(op);
  }
}
