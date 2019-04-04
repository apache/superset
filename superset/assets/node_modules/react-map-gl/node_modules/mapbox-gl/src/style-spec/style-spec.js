// @flow

type ExpressionType = 'data-driven' | 'cross-faded' | 'cross-faded-data-driven' | 'color-ramp' | 'data-constant' | 'constant';
type ExpressionParameters = Array<'zoom' | 'feature' | 'feature-state' | 'heatmap-density' | 'line-progress'>;

type ExpressionSpecification = {
    interpolated: boolean,
    parameters: ExpressionParameters
}

export type StylePropertySpecification = {
    type: 'number',
    'property-type': ExpressionType,
    expression?: ExpressionSpecification,
    transition: boolean,
    default?: number
} | {
    type: 'string',
    'property-type': ExpressionType,
    expression?: ExpressionSpecification,
    transition: boolean,
    default?: string,
    tokens?: boolean
} | {
    type: 'boolean',
    'property-type': ExpressionType,
    expression?: ExpressionSpecification,
    transition: boolean,
    default?: boolean
} | {
    type: 'enum',
    'property-type': ExpressionType,
    expression?: ExpressionSpecification,
    values: {[string]: {}},
    transition: boolean,
    default?: string
} | {
    type: 'color',
    'property-type': ExpressionType,
    expression?: ExpressionSpecification,
    transition: boolean,
    default?: string
} | {
    type: 'array',
    value: 'number',
    'property-type': ExpressionType,
    expression?: ExpressionSpecification,
    length?: number,
    transition: boolean,
    default?: Array<number>
} | {
    type: 'array',
    value: 'string',
    'property-type': ExpressionType,
    expression?: ExpressionSpecification,
    length?: number,
    transition: boolean,
    default?: Array<string>
};

import v8 from './reference/v8.json';
import latest from './reference/latest';
import format from './format';
import migrate from './migrate';
import composite from './composite';
import diff from './diff';
import ValidationError from './error/validation_error';
import ParsingError from './error/parsing_error';
import { StyleExpression, isExpression, createExpression, createPropertyExpression, normalizePropertyExpression, ZoomConstantExpression, ZoomDependentExpression, StylePropertyFunction } from './expression';
import featureFilter from './feature_filter';
import Color from './util/color';
import { createFunction, isFunction } from './function';
import convertFunction from './function/convert';
import { eachSource, eachLayer, eachProperty } from './visit';

import validate from './validate_style';

const expression = {
    StyleExpression,
    isExpression,
    createExpression,
    createPropertyExpression,
    normalizePropertyExpression,
    ZoomConstantExpression,
    ZoomDependentExpression,
    StylePropertyFunction
};

const styleFunction = {
    convertFunction,
    createFunction,
    isFunction
};

const visit = { eachSource, eachLayer, eachProperty };

export {
    v8,
    latest,
    format,
    migrate,
    composite,
    diff,
    ValidationError,
    ParsingError,
    expression,
    featureFilter,
    Color,
    styleFunction as function,
    validate,
    visit
};

validate.parsed = validate;
validate.latest = validate;
