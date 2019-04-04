// @flow

import assert from 'assert';

import { clone, extend, easeCubicInOut } from '../util/util';
import * as interpolate from '../style-spec/util/interpolate';
import { normalizePropertyExpression } from '../style-spec/expression';
import Color from '../style-spec/util/color';
import { register } from '../util/web_worker_transfer';
import EvaluationParameters from './evaluation_parameters';

import type {StylePropertySpecification} from '../style-spec/style-spec';
import type {
    TransitionSpecification,
    PropertyValueSpecification
} from '../style-spec/types';

import type {
    Feature,
    FeatureState,
    StylePropertyExpression,
    SourceExpression,
    CompositeExpression
} from '../style-spec/expression';

type TimePoint = number;

export type CrossFaded<T> = {
    to: T,
    from: T
};

/**
 * Implements a number of classes that define state and behavior for paint and layout properties, most
 * importantly their respective evaluation chains:
 *
 *       Transitionable paint property value
 *     → Transitioning paint property value
 *     → Possibly evaluated paint property value
 *     → Fully evaluated paint property value
 *
 *       Layout property value
 *     → Possibly evaluated layout property value
 *     → Fully evaluated layout property value
 *
 * @module
 * @private
 */

/**
 *  Implementations of the `Property` interface:
 *
 *  * Hold metadata about a property that's independent of any specific value: stuff like the type of the value,
 *    the default value, etc. This comes from the style specification JSON.
 *  * Define behavior that needs to be polymorphic across different properties: "possibly evaluating"
 *    an input value (see below), and interpolating between two possibly-evaluted values.
 *
 *  The type `T` is the fully-evaluated value type (e.g. `number`, `string`, `Color`).
 *  The type `R` is the intermediate "possibly evaluated" value type. See below.
 *
 *  There are two main implementations of the interface -- one for properties that allow data-driven values,
 *  and one for properties that don't. There are a few "special case" implementations as well: one for properties
 *  which cross-fade between two values rather than interpolating, one for `heatmap-color` and `line-gradient`,
 *  and one for `light-position`.
 *
 * @private
 */
export interface Property<T, R> {
    specification: StylePropertySpecification;
    possiblyEvaluate(value: PropertyValue<T, R>, parameters: EvaluationParameters): R;
    interpolate(a: R, b: R, t: number): R;
}

/**
 *  `PropertyValue` represents the value part of a property key-value unit. It's used to represent both
 *  paint and layout property values, and regardless of whether or not their property supports data-driven
 *  expressions.
 *
 *  `PropertyValue` stores the raw input value as seen in a style or a runtime styling API call, i.e. one of the
 *  following:
 *
 *    * A constant value of the type appropriate for the property
 *    * A function which produces a value of that type (but functions are quasi-deprecated in favor of expressions)
 *    * An expression which produces a value of that type
 *    * "undefined"/"not present", in which case the property is assumed to take on its default value.
 *
 *  In addition to storing the original input value, `PropertyValue` also stores a normalized representation,
 *  effectively treating functions as if they are expressions, and constant or default values as if they are
 *  (constant) expressions.
 *
 *  @private
 */
export class PropertyValue<T, R> {
    property: Property<T, R>;
    value: PropertyValueSpecification<T> | void;
    expression: StylePropertyExpression;

    constructor(property: Property<T, R>, value: PropertyValueSpecification<T> | void) {
        this.property = property;
        this.value = value;
        this.expression = normalizePropertyExpression(value === undefined ? property.specification.default : value, property.specification);
    }

    isDataDriven(): boolean {
        return this.expression.kind === 'source' || this.expression.kind === 'composite';
    }

    possiblyEvaluate(parameters: EvaluationParameters): R {
        return this.property.possiblyEvaluate(this, parameters);
    }
}

// ------- Transitionable -------

export type TransitionParameters = {
    now: TimePoint,
    transition: TransitionSpecification
};

/**
 * Paint properties are _transitionable_: they can change in a fluid manner, interpolating or cross-fading between
 * old and new value. The duration of the transition, and the delay before it begins, is configurable.
 *
 * `TransitionablePropertyValue` is a compositional class that stores both the property value and that transition
 * configuration.
 *
 * A `TransitionablePropertyValue` can calculate the next step in the evaluation chain for paint property values:
 * `TransitioningPropertyValue`.
 *
 * @private
 */
class TransitionablePropertyValue<T, R> {
    property: Property<T, R>;
    value: PropertyValue<T, R>;
    transition: TransitionSpecification | void;

    constructor(property: Property<T, R>) {
        this.property = property;
        this.value = new PropertyValue(property, undefined);
    }

    transitioned(parameters: TransitionParameters,
                 prior: TransitioningPropertyValue<T, R>): TransitioningPropertyValue<T, R> {
        return new TransitioningPropertyValue(this.property, this.value, prior, // eslint-disable-line no-use-before-define
            extend({}, parameters.transition, this.transition), parameters.now);
    }

    untransitioned(): TransitioningPropertyValue<T, R> {
        return new TransitioningPropertyValue(this.property, this.value, null, {}, 0); // eslint-disable-line no-use-before-define
    }
}

/**
 * A helper type: given an object type `Properties` whose values are each of type `Property<T, R>`, it calculates
 * an object type with the same keys and values of type `TransitionablePropertyValue<T, R>`.
 *
 * @private
 */
type TransitionablePropertyValues<Props: Object>
    = $Exact<$ObjMap<Props, <T, R>(p: Property<T, R>) => TransitionablePropertyValue<T, R>>>

/**
 * `Transitionable` stores a map of all (property name, `TransitionablePropertyValue`) pairs for paint properties of a
 * given layer type. It can calculate the `TransitioningPropertyValue`s for all of them at once, producing a
 * `Transitioning` instance for the same set of properties.
 *
 * @private
 */
export class Transitionable<Props: Object> {
    _properties: Properties<Props>;
    _values: TransitionablePropertyValues<Props>;

    constructor(properties: Properties<Props>) {
        this._properties = properties;
        this._values = (Object.create(properties.defaultTransitionablePropertyValues): any);
    }

    getValue<S: string, T>(name: S): PropertyValueSpecification<T> | void {
        return clone(this._values[name].value.value);
    }

    setValue<S: string, T>(name: S, value: PropertyValueSpecification<T> | void) {
        if (!this._values.hasOwnProperty(name)) {
            this._values[name] = new TransitionablePropertyValue(this._values[name].property);
        }
        // Note that we do not _remove_ an own property in the case where a value is being reset
        // to the default: the transition might still be non-default.
        this._values[name].value = new PropertyValue(this._values[name].property, value === null ? undefined : clone(value));
    }

    getTransition<S: string>(name: S): TransitionSpecification | void {
        return clone(this._values[name].transition);
    }

    setTransition<S: string>(name: S, value: TransitionSpecification | void) {
        if (!this._values.hasOwnProperty(name)) {
            this._values[name] = new TransitionablePropertyValue(this._values[name].property);
        }
        this._values[name].transition = clone(value) || undefined;
    }

    serialize() {
        const result: any = {};
        for (const property of Object.keys(this._values)) {
            const value = this.getValue(property);
            if (value !== undefined) {
                result[property] = value;
            }

            const transition = this.getTransition(property);
            if (transition !== undefined) {
                result[`${property}-transition`] = transition;
            }
        }
        return result;
    }

    transitioned(parameters: TransitionParameters, prior: Transitioning<Props>): Transitioning<Props> {
        const result = new Transitioning(this._properties); // eslint-disable-line no-use-before-define
        for (const property of Object.keys(this._values)) {
            result._values[property] = this._values[property].transitioned(parameters, prior._values[property]);
        }
        return result;
    }

    untransitioned(): Transitioning<Props> {
        const result = new Transitioning(this._properties); // eslint-disable-line no-use-before-define
        for (const property of Object.keys(this._values)) {
            result._values[property] = this._values[property].untransitioned();
        }
        return result;
    }
}

// ------- Transitioning -------

/**
 * `TransitioningPropertyValue` implements the first of two intermediate steps in the evaluation chain of a paint
 * property value. In this step, transitions between old and new values are handled: as long as the transition is in
 * progress, `TransitioningPropertyValue` maintains a reference to the prior value, and interpolates between it and
 * the new value based on the current time and the configured transition duration and delay. The product is the next
 * step in the evaluation chain: the "possibly evaluated" result type `R`. See below for more on this concept.
 *
 * @private
 */
class TransitioningPropertyValue<T, R> {
    property: Property<T, R>;
    value: PropertyValue<T, R>;
    prior: ?TransitioningPropertyValue<T, R>;
    begin: TimePoint;
    end: TimePoint;

    constructor(property: Property<T, R>,
                value: PropertyValue<T, R>,
                prior: ?TransitioningPropertyValue<T, R>,
                transition: TransitionSpecification,
                now: TimePoint) {
        this.property = property;
        this.value = value;
        this.begin = now + transition.delay || 0;
        this.end = this.begin + transition.duration || 0;
        if (property.specification.transition && (transition.delay || transition.duration)) {
            this.prior = prior;
        }
    }

    possiblyEvaluate(parameters: EvaluationParameters): R {
        const now = parameters.now || 0;
        const finalValue = this.value.possiblyEvaluate(parameters);
        const prior = this.prior;
        if (!prior) {
            // No prior value.
            return finalValue;
        } else if (now > this.end) {
            // Transition from prior value is now complete.
            this.prior = null;
            return finalValue;
        } else if (this.value.isDataDriven()) {
            // Transitions to data-driven properties are not supported.
            // We snap immediately to the data-driven value so that, when we perform layout,
            // we see the data-driven function and can use it to populate vertex buffers.
            this.prior = null;
            return finalValue;
        } else if (now < this.begin) {
            // Transition hasn't started yet.
            return prior.possiblyEvaluate(parameters);
        } else {
            // Interpolate between recursively-calculated prior value and final.
            const t = (now - this.begin) / (this.end - this.begin);
            return this.property.interpolate(prior.possiblyEvaluate(parameters), finalValue, easeCubicInOut(t));
        }
    }
}

/**
 * A helper type: given an object type `Properties` whose values are each of type `Property<T, R>`, it calculates
 * an object type with the same keys and values of type `TransitioningPropertyValue<T, R>`.
 *
 * @private
 */
type TransitioningPropertyValues<Props: Object>
    = $Exact<$ObjMap<Props, <T, R>(p: Property<T, R>) => TransitioningPropertyValue<T, R>>>

/**
 * `Transitioning` stores a map of all (property name, `TransitioningPropertyValue`) pairs for paint properties of a
 * given layer type. It can calculate the possibly-evaluated values for all of them at once, producing a
 * `PossiblyEvaluated` instance for the same set of properties.
 *
 * @private
 */
export class Transitioning<Props: Object> {
    _properties: Properties<Props>;
    _values: TransitioningPropertyValues<Props>;

    constructor(properties: Properties<Props>) {
        this._properties = properties;
        this._values = (Object.create(properties.defaultTransitioningPropertyValues): any);
    }

    possiblyEvaluate(parameters: EvaluationParameters): PossiblyEvaluated<Props> {
        const result = new PossiblyEvaluated(this._properties); // eslint-disable-line no-use-before-define
        for (const property of Object.keys(this._values)) {
            result._values[property] = this._values[property].possiblyEvaluate(parameters);
        }
        return result;
    }

    hasTransition() {
        for (const property of Object.keys(this._values)) {
            if (this._values[property].prior) {
                return true;
            }
        }
        return false;
    }
}

// ------- Layout -------

/**
 * A helper type: given an object type `Properties` whose values are each of type `Property<T, R>`, it calculates
 * an object type with the same keys and values of type `PropertyValue<T, R>`.
 *
 * @private
 */
type PropertyValues<Props: Object>
    = $Exact<$ObjMap<Props, <T, R>(p: Property<T, R>) => PropertyValue<T, R>>>

/**
 * Because layout properties are not transitionable, they have a simpler representation and evaluation chain than
 * paint properties: `PropertyValue`s are possibly evaluated, producing possibly evaluated values, which are then
 * fully evaluated.
 *
 * `Layout` stores a map of all (property name, `PropertyValue`) pairs for layout properties of a
 * given layer type. It can calculate the possibly-evaluated values for all of them at once, producing a
 * `PossiblyEvaluated` instance for the same set of properties.
 *
 * @private
 */
export class Layout<Props: Object> {
    _properties: Properties<Props>;
    _values: PropertyValues<Props>;

    constructor(properties: Properties<Props>) {
        this._properties = properties;
        this._values = (Object.create(properties.defaultPropertyValues): any);
    }

    getValue<S: string>(name: S) {
        return clone(this._values[name].value);
    }

    setValue<S: string>(name: S, value: *) {
        this._values[name] = new PropertyValue(this._values[name].property, value === null ? undefined : clone(value));
    }

    serialize() {
        const result: any = {};
        for (const property of Object.keys(this._values)) {
            const value = this.getValue(property);
            if (value !== undefined) {
                result[property] = value;
            }
        }
        return result;
    }

    possiblyEvaluate(parameters: EvaluationParameters): PossiblyEvaluated<Props> {
        const result = new PossiblyEvaluated(this._properties); // eslint-disable-line no-use-before-define
        for (const property of Object.keys(this._values)) {
            result._values[property] = this._values[property].possiblyEvaluate(parameters);
        }
        return result;
    }
}

// ------- PossiblyEvaluated -------

/**
 * "Possibly evaluated value" is an intermediate stage in the evaluation chain for both paint and layout property
 * values. The purpose of this stage is to optimize away unnecessary recalculations for data-driven properties. Code
 * which uses data-driven property values must assume that the value is dependent on feature data, and request that it
 * be evaluated for each feature. But when that property value is in fact a constant or camera function, the calculation
 * will not actually depend on the feature, and we can benefit from returning the prior result of having done the
 * evaluation once, ahead of time, in an intermediate step whose inputs are just the value and "global" parameters
 * such as current zoom level.
 *
 * `PossiblyEvaluatedValue` represents the three possible outcomes of this step: if the input value was a constant or
 * camera expression, then the "possibly evaluated" result is a constant value. Otherwise, the input value was either
 * a source or composite expression, and we must defer final evaluation until supplied a feature. We separate
 * the source and composite cases because they are handled differently when generating GL attributes, buffers, and
 * uniforms.
 *
 * Note that `PossiblyEvaluatedValue` (and `PossiblyEvaluatedPropertyValue`, below) are _not_ used for properties that
 * do not allow data-driven values. For such properties, we know that the "possibly evaluated" result is always a constant
 * scalar value. See below.
 *
 * @private
 */
type PossiblyEvaluatedValue<T> =
    | {kind: 'constant', value: T}
    | SourceExpression
    | CompositeExpression;

/**
 * `PossiblyEvaluatedPropertyValue` is used for data-driven paint and layout property values. It holds a
 * `PossiblyEvaluatedValue` and the `GlobalProperties` that were used to generate it. You're not allowed to supply
 * a different set of `GlobalProperties` when performing the final evaluation because they would be ignored in the
 * case where the input value was a constant or camera function.
 *
 * @private
 */
export class PossiblyEvaluatedPropertyValue<T> {
    property: DataDrivenProperty<T>;
    value: PossiblyEvaluatedValue<T>;
    parameters: EvaluationParameters;

    constructor(property: DataDrivenProperty<T>, value: PossiblyEvaluatedValue<T>, parameters: EvaluationParameters) {
        this.property = property;
        this.value = value;
        this.parameters = parameters;
    }

    isConstant(): boolean {
        return this.value.kind === 'constant';
    }

    constantOr(value: T): T {
        if (this.value.kind === 'constant') {
            return this.value.value;
        } else {
            return value;
        }
    }

    evaluate(feature: Feature, featureState: FeatureState): T {
        return this.property.evaluate(this.value, this.parameters, feature, featureState);
    }
}

/**
 * A helper type: given an object type `Properties` whose values are each of type `Property<T, R>`, it calculates
 * an object type with the same keys, and values of type `R`.
 *
 * For properties that don't allow data-driven values, `R` is a scalar type such as `number`, `string`, or `Color`.
 * For data-driven properties, it is `PossiblyEvaluatedPropertyValue`. Critically, the type definitions are set up
 * in a way that allows flow to know which of these two cases applies for any given property name, and if you attempt
 * to use a `PossiblyEvaluatedPropertyValue` as if it was a scalar, or vice versa, you will get a type error. (However,
 * there's at least one case in which flow fails to produce a type error that you should be aware of: in a context such
 * as `layer.paint.get('foo-opacity') === 0`, if `foo-opacity` is data-driven, than the left-hand side is of type
 * `PossiblyEvaluatedPropertyValue<number>`, but flow will not complain about comparing this to a number using `===`.
 * See https://github.com/facebook/flow/issues/2359.)
 *
 * There's also a third, special case possiblity for `R`: for cross-faded properties, it's `?CrossFaded<T>`.
 *
 * @private
 */
type PossiblyEvaluatedPropertyValues<Props: Object>
    = $Exact<$ObjMap<Props, <T, R>(p: Property<T, R>) => R>>

/**
 * `PossiblyEvaluated` stores a map of all (property name, `R`) pairs for paint or layout properties of a
 * given layer type.
 * @private
 */
export class PossiblyEvaluated<Props: Object> {
    _properties: Properties<Props>;
    _values: PossiblyEvaluatedPropertyValues<Props>;

    constructor(properties: Properties<Props>) {
        this._properties = properties;
        this._values = (Object.create(properties.defaultPossiblyEvaluatedValues): any);
    }

    get<S: string>(name: S): $ElementType<PossiblyEvaluatedPropertyValues<Props>, S> {
        return this._values[name];
    }
}

/**
 * An implementation of `Property` for properties that do not permit data-driven (source or composite) expressions.
 * This restriction allows us to declare statically that the result of possibly evaluating this kind of property
 * is in fact always the scalar type `T`, and can be used without further evaluating the value on a per-feature basis.
 *
 * @private
 */
export class DataConstantProperty<T> implements Property<T, T> {
    specification: StylePropertySpecification;

    constructor(specification: StylePropertySpecification) {
        this.specification = specification;
    }

    possiblyEvaluate(value: PropertyValue<T, T>, parameters: EvaluationParameters): T {
        assert(!value.isDataDriven());
        return value.expression.evaluate(parameters);
    }

    interpolate(a: T, b: T, t: number): T {
        const interp: ?(a: T, b: T, t: number) => T = (interpolate: any)[this.specification.type];
        if (interp) {
            return interp(a, b, t);
        } else {
            return a;
        }
    }
}

/**
 * An implementation of `Property` for properties that permit data-driven (source or composite) expressions.
 * The result of possibly evaluating this kind of property is `PossiblyEvaluatedPropertyValue<T>`; obtaining
 * a scalar value `T` requires further evaluation on a per-feature basis.
 *
 * @private
 */
export class DataDrivenProperty<T> implements Property<T, PossiblyEvaluatedPropertyValue<T>> {
    specification: StylePropertySpecification;

    constructor(specification: StylePropertySpecification) {
        this.specification = specification;
    }

    possiblyEvaluate(value: PropertyValue<T, PossiblyEvaluatedPropertyValue<T>>, parameters: EvaluationParameters): PossiblyEvaluatedPropertyValue<T> {
        if (value.expression.kind === 'constant' || value.expression.kind === 'camera') {
            return new PossiblyEvaluatedPropertyValue(this, {kind: 'constant', value: value.expression.evaluate(parameters)}, parameters);
        } else {
            return new PossiblyEvaluatedPropertyValue(this, value.expression, parameters);
        }
    }

    interpolate(a: PossiblyEvaluatedPropertyValue<T>,
                b: PossiblyEvaluatedPropertyValue<T>,
                t: number): PossiblyEvaluatedPropertyValue<T> {
        // If either possibly-evaluated value is non-constant, give up: we aren't able to interpolate data-driven values.
        if (a.value.kind !== 'constant' || b.value.kind !== 'constant') {
            return a;
        }

        // Special case hack solely for fill-outline-color. The undefined value is subsequently handled in
        // FillStyleLayer#recalculate, which sets fill-outline-color to the fill-color value if the former
        // is a PossiblyEvaluatedPropertyValue containing a constant undefined value. In addition to the
        // return value here, the other source of a PossiblyEvaluatedPropertyValue containing a constant
        // undefined value is the "default value" for fill-outline-color held in
        // `Properties#defaultPossiblyEvaluatedValues`, which serves as the prototype of
        // `PossiblyEvaluated#_values`.
        if (a.value.value === undefined || b.value.value === undefined) {
            return new PossiblyEvaluatedPropertyValue(this, {kind: 'constant', value: (undefined: any)}, a.parameters);
        }

        const interp: ?(a: T, b: T, t: number) => T = (interpolate: any)[this.specification.type];
        if (interp) {
            return new PossiblyEvaluatedPropertyValue(this, {kind: 'constant', value: interp(a.value.value, b.value.value, t)}, a.parameters);
        } else {
            return a;
        }
    }

    evaluate(value: PossiblyEvaluatedValue<T>, parameters: EvaluationParameters, feature: Feature, featureState: FeatureState): T {
        if (value.kind === 'constant') {
            return value.value;
        } else {
            return value.evaluate(parameters, feature, featureState);
        }
    }
}

/**
 * An implementation of `Property` for  data driven `line-pattern` which are transitioned by cross-fading
 * rather than interpolation.
 *
 * @private
 */

export class CrossFadedDataDrivenProperty<T> extends DataDrivenProperty<?CrossFaded<T>> {

    possiblyEvaluate(value: PropertyValue<?CrossFaded<T>, PossiblyEvaluatedPropertyValue<?CrossFaded<T>>>, parameters: EvaluationParameters): PossiblyEvaluatedPropertyValue<?CrossFaded<T>> {
        if (value.value === undefined) {
            return new PossiblyEvaluatedPropertyValue(this, {kind: 'constant', value: undefined}, parameters);
        } else if (value.expression.kind === 'constant') {
            const constantValue = value.expression.evaluate(parameters);
            const constant = this._calculate(constantValue, constantValue, constantValue, parameters);
            return new PossiblyEvaluatedPropertyValue(this, {kind: 'constant', value: constant}, parameters);
        } else if (value.expression.kind === 'camera') {
            const cameraVal = this._calculate(
                    value.expression.evaluate({zoom: parameters.zoom - 1.0}),
                    value.expression.evaluate({zoom: parameters.zoom}),
                    value.expression.evaluate({zoom: parameters.zoom + 1.0}),
                    parameters);
            return new PossiblyEvaluatedPropertyValue(this, {kind: 'constant', value: cameraVal}, parameters);
        } else {
            // source or composite expression
            return new PossiblyEvaluatedPropertyValue(this, value.expression, parameters);
        }
    }


    evaluate(value: PossiblyEvaluatedValue<?CrossFaded<T>>, globals: EvaluationParameters, feature: Feature, featureState: FeatureState): ?CrossFaded<T> {
        if (value.kind === 'source') {
            const constant = value.evaluate(globals, feature, featureState);
            return this._calculate(constant, constant, constant, globals);
        } else if (value.kind === 'composite') {
            return this._calculate(
                value.evaluate({zoom: Math.floor(globals.zoom) - 1.0}, feature, featureState),
                value.evaluate({zoom: Math.floor(globals.zoom)}, feature, featureState),
                value.evaluate({zoom: Math.floor(globals.zoom) + 1.0}, feature, featureState),
                globals);
        } else {
            return value.value;
        }
    }

    _calculate(min: T, mid: T, max: T, parameters: EvaluationParameters): CrossFaded<T> {
        const z = parameters.zoom;
        return z > parameters.zoomHistory.lastIntegerZoom ? { from: min, to: mid } : { from: max, to: mid };
    }

    interpolate(a: PossiblyEvaluatedPropertyValue<?CrossFaded<T>>): PossiblyEvaluatedPropertyValue<?CrossFaded<T>> {
        return a;
    }
}
/**
 * An implementation of `Property` for `*-pattern` and `line-dasharray`, which are transitioned by cross-fading
 * rather than interpolation.
 *
 * @private
 */
export class CrossFadedProperty<T> implements Property<T, ?CrossFaded<T>> {
    specification: StylePropertySpecification;

    constructor(specification: StylePropertySpecification) {
        this.specification = specification;
    }

    possiblyEvaluate(value: PropertyValue<T, ?CrossFaded<T>>, parameters: EvaluationParameters): ?CrossFaded<T> {
        if (value.value === undefined) {
            return undefined;
        } else if (value.expression.kind === 'constant') {
            const constant = value.expression.evaluate(parameters);
            return this._calculate(constant, constant, constant, parameters);
        } else {
            assert(!value.isDataDriven());
            return this._calculate(
                value.expression.evaluate(new EvaluationParameters(Math.floor(parameters.zoom - 1.0), parameters)),
                value.expression.evaluate(new EvaluationParameters(Math.floor(parameters.zoom), parameters)),
                value.expression.evaluate(new EvaluationParameters(Math.floor(parameters.zoom + 1.0), parameters)),
                parameters);
        }
    }

    _calculate(min: T, mid: T, max: T, parameters: EvaluationParameters): ?CrossFaded<T> {
        const z = parameters.zoom;
        return z > parameters.zoomHistory.lastIntegerZoom ? { from: min, to: mid } : { from: max, to: mid };
    }

    interpolate(a: ?CrossFaded<T>): ?CrossFaded<T> {
        return a;
    }
}

/**
 * An implementation of `Property` for `heatmap-color` and `line-gradient`. Interpolation is a no-op, and
 * evaluation returns a boolean value in order to indicate its presence, but the real
 * evaluation happens in StyleLayer classes.
 *
 * @private
 */

export class ColorRampProperty implements Property<Color, boolean> {
    specification: StylePropertySpecification;

    constructor(specification: StylePropertySpecification) {
        this.specification = specification;
    }

    possiblyEvaluate(value: PropertyValue<Color, boolean>, parameters: EvaluationParameters): boolean {
        return !!value.expression.evaluate(parameters);
    }

    interpolate(): boolean { return false; }
}

/**
 * `Properties` holds objects containing default values for the layout or paint property set of a given
 * layer type. These objects are immutable, and they are used as the prototypes for the `_values` members of
 * `Transitionable`, `Transitioning`, `Layout`, and `PossiblyEvaluated`. This allows these classes to avoid
 * doing work in the common case where a property has no explicit value set and should be considered to take
 * on the default value: using `for (const property of Object.keys(this._values))`, they can iterate over
 * only the _own_ properties of `_values`, skipping repeated calculation of transitions and possible/final
 * evaluations for defaults, the result of which will always be the same.
 *
 * @private
 */
export class Properties<Props: Object> {
    properties: Props;
    defaultPropertyValues: PropertyValues<Props>;
    defaultTransitionablePropertyValues: TransitionablePropertyValues<Props>;
    defaultTransitioningPropertyValues: TransitioningPropertyValues<Props>;
    defaultPossiblyEvaluatedValues: PossiblyEvaluatedPropertyValues<Props>;

    constructor(properties: Props) {
        this.properties = properties;
        this.defaultPropertyValues = ({}: any);
        this.defaultTransitionablePropertyValues = ({}: any);
        this.defaultTransitioningPropertyValues = ({}: any);
        this.defaultPossiblyEvaluatedValues = ({}: any);

        for (const property in properties) {
            const prop = properties[property];
            const defaultPropertyValue = this.defaultPropertyValues[property] =
                new PropertyValue(prop, undefined);
            const defaultTransitionablePropertyValue = this.defaultTransitionablePropertyValues[property] =
                new TransitionablePropertyValue(prop);
            this.defaultTransitioningPropertyValues[property] =
                defaultTransitionablePropertyValue.untransitioned();
            this.defaultPossiblyEvaluatedValues[property] =
                defaultPropertyValue.possiblyEvaluate(({}: any));
        }
    }
}

register('DataDrivenProperty', DataDrivenProperty);
register('DataConstantProperty', DataConstantProperty);
register('CrossFadedDataDrivenProperty', CrossFadedDataDrivenProperty);
register('CrossFadedProperty', CrossFadedProperty);
register('ColorRampProperty', ColorRampProperty);
