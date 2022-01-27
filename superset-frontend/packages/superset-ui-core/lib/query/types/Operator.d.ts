/** List of operators that do not require another operand */
declare const UNARY_OPERATORS: readonly ["IS NOT NULL", "IS NULL"];
/** List of operators that require another operand that is a single value */
declare const BINARY_OPERATORS: readonly ["==", "!=", ">", "<", ">=", "<=", "ILIKE", "LIKE", "REGEX"];
/** List of operators that require another operand that is a set */
declare const SET_OPERATORS: readonly ["IN", "NOT IN"];
/** An operator that does not require another operand */
export declare type UnaryOperator = typeof UNARY_OPERATORS[number];
/** An operator that requires another operand that is a single value */
export declare type BinaryOperator = typeof BINARY_OPERATORS[number];
/** An operator that require another operand that is a set */
export declare type SetOperator = typeof SET_OPERATORS[number];
export declare function isUnaryOperator(operator: string): operator is UnaryOperator;
export declare function isBinaryOperator(operator: string): operator is BinaryOperator;
export declare function isSetOperator(operator: string): operator is SetOperator;
export {};
//# sourceMappingURL=Operator.d.ts.map