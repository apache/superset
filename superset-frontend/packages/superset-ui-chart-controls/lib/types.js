// Ref:
//  - superset-frontend/src/explore/components/ConditionalFormattingControl.tsx
export var COMPARATOR;
(function (COMPARATOR) {
    COMPARATOR["NONE"] = "None";
    COMPARATOR["GREATER_THAN"] = ">";
    COMPARATOR["LESS_THAN"] = "<";
    COMPARATOR["GREATER_OR_EQUAL"] = "\u2265";
    COMPARATOR["LESS_OR_EQUAL"] = "\u2264";
    COMPARATOR["EQUAL"] = "=";
    COMPARATOR["NOT_EQUAL"] = "\u2260";
    COMPARATOR["BETWEEN"] = "< x <";
    COMPARATOR["BETWEEN_OR_EQUAL"] = "\u2264 x \u2264";
    COMPARATOR["BETWEEN_OR_LEFT_EQUAL"] = "\u2264 x <";
    COMPARATOR["BETWEEN_OR_RIGHT_EQUAL"] = "< x \u2264";
})(COMPARATOR || (COMPARATOR = {}));
export const MULTIPLE_VALUE_COMPARATORS = [
    COMPARATOR.BETWEEN,
    COMPARATOR.BETWEEN_OR_EQUAL,
    COMPARATOR.BETWEEN_OR_LEFT_EQUAL,
    COMPARATOR.BETWEEN_OR_RIGHT_EQUAL,
];
export default {};
export function isColumnMeta(column) {
    return 'column_name' in column;
}
export function isSavedExpression(column) {
    return ('column_name' in column && 'expression' in column && !!column.expression);
}
export function isAdhocColumn(column) {
    return 'label' in column && 'sqlExpression' in column;
}
//# sourceMappingURL=types.js.map