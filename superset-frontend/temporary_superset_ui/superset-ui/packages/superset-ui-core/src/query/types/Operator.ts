/** List of operators that do not require another operand */
const UNARY_OPERATORS = ['IS NOT NULL', 'IS NULL'] as const;

/** List of operators that require another operand that is a single value */
const BINARY_OPERATORS = ['==', '!=', '>', '<', '>=', '<=', 'ILIKE', 'LIKE', 'REGEX'] as const;

/** List of operators that require another operand that is a set */
const SET_OPERATORS = ['IN', 'NOT IN'] as const;

//---------------------------------------------------
// Derived types
//---------------------------------------------------

/** An operator that does not require another operand */
export type UnaryOperator = typeof UNARY_OPERATORS[number];

/** An operator that requires another operand that is a single value */
export type BinaryOperator = typeof BINARY_OPERATORS[number];

/** An operator that require another operand that is a set */
export type SetOperator = typeof SET_OPERATORS[number];

//---------------------------------------------------
// Type guards
//---------------------------------------------------

const unaryOperatorSet = new Set<string>(UNARY_OPERATORS);

export function isUnaryOperator(operator: string): operator is UnaryOperator {
  return unaryOperatorSet.has(operator);
}

const binaryOperatorSet = new Set<string>(BINARY_OPERATORS);

export function isBinaryOperator(operator: string): operator is BinaryOperator {
  return binaryOperatorSet.has(operator);
}

const setOperatorSet = new Set<string>(SET_OPERATORS);

export function isSetOperator(operator: string): operator is SetOperator {
  return setOperatorSet.has(operator);
}
