// @flow

import assert from 'assert';

import extend from '../util/extend';
import ParsingError from './parsing_error';
import ParsingContext from './parsing_context';
import EvaluationContext from './evaluation_context';
import CompoundExpression from './compound_expression';
import Step from './definitions/step';
import Interpolate from './definitions/interpolate';
import Coalesce from './definitions/coalesce';
import Let from './definitions/let';
import definitions from './definitions';
import * as isConstant from './is_constant';
import RuntimeError from './runtime_error';
import { success, error } from '../util/result';
import { supportsPropertyExpression, supportsZoomExpression, supportsInterpolation } from '../util/properties';

import type {Type, EvaluationKind} from './types';
import type {Value} from './values';
import type {Expression} from './expression';
import type {StylePropertySpecification} from '../style-spec';
import type {Result} from '../util/result';
import type {InterpolationType} from './definitions/interpolate';
import type {PropertyValueSpecification} from '../types';

export type Feature = {
    +type: 1 | 2 | 3 | 'Unknown' | 'Point' | 'MultiPoint' | 'LineString' | 'MultiLineString' | 'Polygon' | 'MultiPolygon',
    +id?: any,
    +properties: {[string]: any},
    +patterns?: {[string]: {"min": string, "mid": string, "max": string}}
};

export type FeatureState = {[string]: any};

export type GlobalProperties = $ReadOnly<{
    zoom: number,
    heatmapDensity?: number,
    lineProgress?: number,
    isSupportedScript?: (string) => boolean,
    accumulated?: Value
}>;

export class StyleExpression {
    expression: Expression;

    _evaluator: EvaluationContext;
    _defaultValue: Value;
    _warningHistory: {[key: string]: boolean};
    _enumValues: ?{[string]: any};

    constructor(expression: Expression, propertySpec: ?StylePropertySpecification) {
        this.expression = expression;
        this._warningHistory = {};
        this._evaluator = new EvaluationContext();
        this._defaultValue = propertySpec ? getDefaultValue(propertySpec) : null;
        this._enumValues = propertySpec && propertySpec.type === 'enum' ? propertySpec.values : null;
    }

    evaluateWithoutErrorHandling(globals: GlobalProperties, feature?: Feature, featureState?: FeatureState): any {
        this._evaluator.globals = globals;
        this._evaluator.feature = feature;
        this._evaluator.featureState = featureState;

        return this.expression.evaluate(this._evaluator);
    }

    evaluate(globals: GlobalProperties, feature?: Feature, featureState?: FeatureState): any {
        this._evaluator.globals = globals;
        this._evaluator.feature = feature || null;
        this._evaluator.featureState = featureState || null;

        try {
            const val = this.expression.evaluate(this._evaluator);
            if (val === null || val === undefined) {
                return this._defaultValue;
            }
            if (this._enumValues && !(val in this._enumValues)) {
                throw new RuntimeError(`Expected value to be one of ${Object.keys(this._enumValues).map(v => JSON.stringify(v)).join(', ')}, but found ${JSON.stringify(val)} instead.`);
            }
            return val;
        } catch (e) {
            if (!this._warningHistory[e.message]) {
                this._warningHistory[e.message] = true;
                if (typeof console !== 'undefined') {
                    console.warn(e.message);
                }
            }
            return this._defaultValue;
        }
    }
}

export function isExpression(expression: mixed) {
    return Array.isArray(expression) && expression.length > 0 &&
        typeof expression[0] === 'string' && expression[0] in definitions;
}

/**
 * Parse and typecheck the given style spec JSON expression.  If
 * options.defaultValue is provided, then the resulting StyleExpression's
 * `evaluate()` method will handle errors by logging a warning (once per
 * message) and returning the default value.  Otherwise, it will throw
 * evaluation errors.
 *
 * @private
 */
export function createExpression(expression: mixed, propertySpec: ?StylePropertySpecification): Result<StyleExpression, Array<ParsingError>> {
    const parser = new ParsingContext(definitions, [], propertySpec ? getExpectedType(propertySpec) : undefined);

    // For string-valued properties, coerce to string at the top level rather than asserting.
    const parsed = parser.parse(expression, undefined, undefined, undefined,
        propertySpec && propertySpec.type === 'string' ? {typeAnnotation: 'coerce'} : undefined);

    if (!parsed) {
        assert(parser.errors.length > 0);
        return error(parser.errors);
    }

    return success(new StyleExpression(parsed, propertySpec));
}

export class ZoomConstantExpression<Kind: EvaluationKind> {
    kind: Kind;
    isStateDependent: boolean;
    _styleExpression: StyleExpression;

    constructor(kind: Kind, expression: StyleExpression) {
        this.kind = kind;
        this._styleExpression = expression;
        this.isStateDependent = kind !== ('constant': EvaluationKind) && !isConstant.isStateConstant(expression.expression);
    }

    evaluateWithoutErrorHandling(globals: GlobalProperties, feature?: Feature, featureState?: FeatureState): any {
        return this._styleExpression.evaluateWithoutErrorHandling(globals, feature, featureState);
    }

    evaluate(globals: GlobalProperties, feature?: Feature, featureState?: FeatureState): any {
        return this._styleExpression.evaluate(globals, feature, featureState);
    }
}

export class ZoomDependentExpression<Kind: EvaluationKind> {
    kind: Kind;
    zoomStops: Array<number>;
    isStateDependent: boolean;

    _styleExpression: StyleExpression;
    _interpolationType: ?InterpolationType;

    constructor(kind: Kind, expression: StyleExpression, zoomCurve: Step | Interpolate) {
        this.kind = kind;
        this.zoomStops = zoomCurve.labels;
        this._styleExpression = expression;
        this.isStateDependent = kind !== ('camera': EvaluationKind) && !isConstant.isStateConstant(expression.expression);
        if (zoomCurve instanceof Interpolate) {
            this._interpolationType = zoomCurve.interpolation;
        }
    }

    evaluateWithoutErrorHandling(globals: GlobalProperties, feature?: Feature, featureState?: FeatureState): any {
        return this._styleExpression.evaluateWithoutErrorHandling(globals, feature, featureState);
    }

    evaluate(globals: GlobalProperties, feature?: Feature, featureState?: FeatureState): any {
        return this._styleExpression.evaluate(globals, feature, featureState);
    }

    interpolationFactor(input: number, lower: number, upper: number): number {
        if (this._interpolationType) {
            return Interpolate.interpolationFactor(this._interpolationType, input, lower, upper);
        } else {
            return 0;
        }
    }
}

export type ConstantExpression = {
    kind: 'constant',
    +evaluate: (globals: GlobalProperties, feature?: Feature) => any,
}

export type SourceExpression = {
    kind: 'source',
    isStateDependent: boolean,
    +evaluate: (globals: GlobalProperties, feature?: Feature, featureState?: FeatureState) => any,
};

export type CameraExpression = {
    kind: 'camera',
    +evaluate: (globals: GlobalProperties, feature?: Feature, featureState?: FeatureState) => any,
    +interpolationFactor: (input: number, lower: number, upper: number) => number,
    zoomStops: Array<number>
};

export type CompositeExpression = {
    kind: 'composite',
    isStateDependent: boolean,
    +evaluate: (globals: GlobalProperties, feature?: Feature, featureState?: FeatureState) => any,
    +interpolationFactor: (input: number, lower: number, upper: number) => number,
    zoomStops: Array<number>
};

export type StylePropertyExpression =
    | ConstantExpression
    | SourceExpression
    | CameraExpression
    | CompositeExpression;

export function createPropertyExpression(expression: mixed, propertySpec: StylePropertySpecification): Result<StylePropertyExpression, Array<ParsingError>> {
    expression = createExpression(expression, propertySpec);
    if (expression.result === 'error') {
        return expression;
    }

    const parsed = expression.value.expression;

    const isFeatureConstant = isConstant.isFeatureConstant(parsed);
    if (!isFeatureConstant && !supportsPropertyExpression(propertySpec)) {
        return error([new ParsingError('', 'data expressions not supported')]);
    }

    const isZoomConstant = isConstant.isGlobalPropertyConstant(parsed, ['zoom']);
    if (!isZoomConstant && !supportsZoomExpression(propertySpec)) {
        return error([new ParsingError('', 'zoom expressions not supported')]);
    }

    const zoomCurve = findZoomCurve(parsed);
    if (!zoomCurve && !isZoomConstant) {
        return error([new ParsingError('', '"zoom" expression may only be used as input to a top-level "step" or "interpolate" expression.')]);
    } else if (zoomCurve instanceof ParsingError) {
        return error([zoomCurve]);
    } else if (zoomCurve instanceof Interpolate && !supportsInterpolation(propertySpec)) {
        return error([new ParsingError('', '"interpolate" expressions cannot be used with this property')]);
    }

    if (!zoomCurve) {
        return success(isFeatureConstant ?
            (new ZoomConstantExpression('constant', expression.value): ConstantExpression) :
            (new ZoomConstantExpression('source', expression.value): SourceExpression));
    }

    return success(isFeatureConstant ?
        (new ZoomDependentExpression('camera', expression.value, zoomCurve): CameraExpression) :
        (new ZoomDependentExpression('composite', expression.value, zoomCurve): CompositeExpression));
}

import { isFunction, createFunction } from '../function';
import { Color } from './values';

// serialization wrapper for old-style stop functions normalized to the
// expression interface
export class StylePropertyFunction<T> {
    _parameters: PropertyValueSpecification<T>;
    _specification: StylePropertySpecification;

    kind: EvaluationKind;
    evaluate: (globals: GlobalProperties, feature?: Feature) => any;
    interpolationFactor: ?(input: number, lower: number, upper: number) => number;
    zoomStops: ?Array<number>;

    constructor(parameters: PropertyValueSpecification<T>, specification: StylePropertySpecification) {
        this._parameters = parameters;
        this._specification = specification;
        extend(this, createFunction(this._parameters, this._specification));
    }

    static deserialize(serialized: {_parameters: PropertyValueSpecification<T>, _specification: StylePropertySpecification}) {
        return ((new StylePropertyFunction(serialized._parameters, serialized._specification)): StylePropertyFunction<T>);
    }

    static serialize(input: StylePropertyFunction<T>) {
        return {
            _parameters: input._parameters,
            _specification: input._specification
        };
    }
}

export function normalizePropertyExpression<T>(value: PropertyValueSpecification<T>, specification: StylePropertySpecification): StylePropertyExpression {
    if (isFunction(value)) {
        return (new StylePropertyFunction(value, specification): any);

    } else if (isExpression(value)) {
        const expression = createPropertyExpression(value, specification);
        if (expression.result === 'error') {
            // this should have been caught in validation
            throw new Error(expression.value.map(err => `${err.key}: ${err.message}`).join(', '));
        }
        return expression.value;

    } else {
        let constant: any = value;
        if (typeof value === 'string' && specification.type === 'color') {
            constant = Color.parse(value);
        }
        return {
            kind: 'constant',
            evaluate: () => constant
        };
    }
}

// Zoom-dependent expressions may only use ["zoom"] as the input to a top-level "step" or "interpolate"
// expression (collectively referred to as a "curve"). The curve may be wrapped in one or more "let" or
// "coalesce" expressions.
function findZoomCurve(expression: Expression): Step | Interpolate | ParsingError | null {
    let result = null;
    if (expression instanceof Let) {
        result = findZoomCurve(expression.result);

    } else if (expression instanceof Coalesce) {
        for (const arg of expression.args) {
            result = findZoomCurve(arg);
            if (result) {
                break;
            }
        }

    } else if ((expression instanceof Step || expression instanceof Interpolate) &&
        expression.input instanceof CompoundExpression &&
        expression.input.name === 'zoom') {

        result = expression;
    }

    if (result instanceof ParsingError) {
        return result;
    }

    expression.eachChild((child) => {
        const childResult = findZoomCurve(child);
        if (childResult instanceof ParsingError) {
            result = childResult;
        } else if (!result && childResult) {
            result = new ParsingError('', '"zoom" expression may only be used as input to a top-level "step" or "interpolate" expression.');
        } else if (result && childResult && result !== childResult) {
            result = new ParsingError('', 'Only one zoom-based "step" or "interpolate" subexpression may be used in an expression.');
        }
    });

    return result;
}

import { ColorType, StringType, NumberType, BooleanType, ValueType, FormattedType, array } from './types';

function getExpectedType(spec: StylePropertySpecification): Type {
    const types = {
        color: ColorType,
        string: StringType,
        number: NumberType,
        enum: StringType,
        boolean: BooleanType,
        formatted: FormattedType
    };

    if (spec.type === 'array') {
        return array(types[spec.value] || ValueType, spec.length);
    }

    return types[spec.type];
}

function getDefaultValue(spec: StylePropertySpecification): Value {
    if (spec.type === 'color' && isFunction(spec.default)) {
        // Special case for heatmap-color: it uses the 'default:' to define a
        // default color ramp, but createExpression expects a simple value to fall
        // back to in case of runtime errors
        return new Color(0, 0, 0, 0);
    } else if (spec.type === 'color') {
        return Color.parse(spec.default) || null;
    } else if (spec.default === undefined) {
        return null;
    } else {
        return spec.default;
    }
}
