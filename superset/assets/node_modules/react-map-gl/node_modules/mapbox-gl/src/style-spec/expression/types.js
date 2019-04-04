// @flow

export type NullTypeT = { kind: 'null' };
export type NumberTypeT = { kind: 'number' };
export type StringTypeT = { kind: 'string' };
export type BooleanTypeT = { kind: 'boolean' };
export type ColorTypeT = { kind: 'color' };
export type ObjectTypeT = { kind: 'object' };
export type ValueTypeT = { kind: 'value' };
export type ErrorTypeT = { kind: 'error' };
export type CollatorTypeT = { kind: 'collator' };
export type FormattedTypeT = { kind: 'formatted' };

export type EvaluationKind = 'constant' | 'source' | 'camera' | 'composite';

export type Type =
    NullTypeT |
    NumberTypeT |
    StringTypeT |
    BooleanTypeT |
    ColorTypeT |
    ObjectTypeT |
    ValueTypeT |
    ArrayType | // eslint-disable-line no-use-before-define
    ErrorTypeT |
    CollatorTypeT |
    FormattedTypeT

export type ArrayType = {
    kind: 'array',
    itemType: Type,
    N: ?number
}

export const NullType = { kind: 'null' };
export const NumberType = { kind: 'number' };
export const StringType = { kind: 'string' };
export const BooleanType = { kind: 'boolean' };
export const ColorType = { kind: 'color' };
export const ObjectType = { kind: 'object' };
export const ValueType = { kind: 'value' };
export const ErrorType = { kind: 'error' };
export const CollatorType = { kind: 'collator' };
export const FormattedType = { kind: 'formatted' };

export function array(itemType: Type, N: ?number): ArrayType {
    return {
        kind: 'array',
        itemType,
        N
    };
}

export function toString(type: Type): string {
    if (type.kind === 'array') {
        const itemType = toString(type.itemType);
        return typeof type.N === 'number' ?
            `array<${itemType}, ${type.N}>` :
            type.itemType.kind === 'value' ? 'array' : `array<${itemType}>`;
    } else {
        return type.kind;
    }
}

const valueMemberTypes = [
    NullType,
    NumberType,
    StringType,
    BooleanType,
    ColorType,
    FormattedType,
    ObjectType,
    array(ValueType)
];

/**
 * Returns null if `t` is a subtype of `expected`; otherwise returns an
 * error message.
 * @private
 */
export function checkSubtype(expected: Type, t: Type): ?string {
    if (t.kind === 'error') {
        // Error is a subtype of every type
        return null;
    } else if (expected.kind === 'array') {
        if (t.kind === 'array' &&
            ((t.N === 0 && t.itemType.kind === 'value') || !checkSubtype(expected.itemType, t.itemType)) &&
            (typeof expected.N !== 'number' || expected.N === t.N)) {
            return null;
        }
    } else if (expected.kind === t.kind) {
        return null;
    } else if (expected.kind === 'value') {
        for (const memberType of valueMemberTypes) {
            if (!checkSubtype(memberType, t)) {
                return null;
            }
        }
    }

    return `Expected ${toString(expected)} but found ${toString(t)} instead.`;
}
