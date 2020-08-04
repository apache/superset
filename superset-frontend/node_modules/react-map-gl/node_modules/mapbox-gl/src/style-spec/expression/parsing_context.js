// @flow

import Scope from './scope';
import { checkSubtype } from './types';
import ParsingError from './parsing_error';
import Literal from './definitions/literal';
import Assertion from './definitions/assertion';
import Coercion from './definitions/coercion';
import EvaluationContext from './evaluation_context';
import CompoundExpression from './compound_expression';
import CollatorExpression from './definitions/collator';
import {isGlobalPropertyConstant, isFeatureConstant} from './is_constant';
import Var from './definitions/var';


import type {Expression, ExpressionRegistry} from './expression';
import type {Type} from './types';

/**
 * State associated parsing at a given point in an expression tree.
 * @private
 */
class ParsingContext {
    registry: ExpressionRegistry;
    path: Array<number>;
    key: string;
    scope: Scope;
    errors: Array<ParsingError>;

    // The expected type of this expression. Provided only to allow Expression
    // implementations to infer argument types: Expression#parse() need not
    // check that the output type of the parsed expression matches
    // `expectedType`.
    expectedType: ?Type;

    constructor(
        registry: ExpressionRegistry,
        path: Array<number> = [],
        expectedType: ?Type,
        scope: Scope = new Scope(),
        errors: Array<ParsingError> = []
    ) {
        this.registry = registry;
        this.path = path;
        this.key = path.map(part => `[${part}]`).join('');
        this.scope = scope;
        this.errors = errors;
        this.expectedType = expectedType;
    }

    /**
     * @param expr the JSON expression to parse
     * @param index the optional argument index if this expression is an argument of a parent expression that's being parsed
     * @param options
     * @param options.omitTypeAnnotations set true to omit inferred type annotations.  Caller beware: with this option set, the parsed expression's type will NOT satisfy `expectedType` if it would normally be wrapped in an inferred annotation.
     * @private
     */
    parse(
        expr: mixed,
        index?: number,
        expectedType?: ?Type,
        bindings?: Array<[string, Expression]>,
        options: {typeAnnotation?: 'assert' | 'coerce' | 'omit'} = {}
    ): ?Expression {
        if (index) {
            return this.concat(index, expectedType, bindings)._parse(expr, options);
        }
        return this._parse(expr, options);
    }

    _parse(expr: mixed, options: {typeAnnotation?: 'assert' | 'coerce' | 'omit'}): ?Expression {
        if (expr === null || typeof expr === 'string' || typeof expr === 'boolean' || typeof expr === 'number') {
            expr = ['literal', expr];
        }

        function annotate(parsed, type, typeAnnotation: 'assert' | 'coerce' | 'omit') {
            if (typeAnnotation === 'assert') {
                return new Assertion(type, [parsed]);
            } else if (typeAnnotation === 'coerce') {
                return new Coercion(type, [parsed]);
            } else {
                return parsed;
            }
        }

        if (Array.isArray(expr)) {
            if (expr.length === 0) {
                return this.error(`Expected an array with at least one element. If you wanted a literal array, use ["literal", []].`);
            }

            const op = expr[0];
            if (typeof op !== 'string') {
                this.error(`Expression name must be a string, but found ${typeof op} instead. If you wanted a literal array, use ["literal", [...]].`, 0);
                return null;
            }

            const Expr = this.registry[op];
            if (Expr) {
                let parsed = Expr.parse(expr, this);
                if (!parsed) return null;

                if (this.expectedType) {
                    const expected = this.expectedType;
                    const actual = parsed.type;

                    // When we expect a number, string, boolean, or array but have a value, wrap it in an assertion.
                    // When we expect a color or formatted string, but have a string or value, wrap it in a coercion.
                    // Otherwise, we do static type-checking.
                    //
                    // These behaviors are overridable for:
                    //   * The "coalesce" operator, which needs to omit type annotations.
                    //   * String-valued properties (e.g. `text-field`), where coercion is more convenient than assertion.
                    //
                    if ((expected.kind === 'string' || expected.kind === 'number' || expected.kind === 'boolean' || expected.kind === 'object' || expected.kind === 'array') && actual.kind === 'value') {
                        parsed = annotate(parsed, expected, options.typeAnnotation || 'assert');
                    } else if ((expected.kind === 'color' || expected.kind === 'formatted') && (actual.kind === 'value' || actual.kind === 'string')) {
                        parsed = annotate(parsed, expected, options.typeAnnotation || 'coerce');
                    } else if (this.checkSubtype(expected, actual)) {
                        return null;
                    }
                }

                // If an expression's arguments are all literals, we can evaluate
                // it immediately and replace it with a literal value in the
                // parsed/compiled result.
                if (!(parsed instanceof Literal) && isConstant(parsed)) {
                    const ec = new EvaluationContext();
                    try {
                        parsed = new Literal(parsed.type, parsed.evaluate(ec));
                    } catch (e) {
                        this.error(e.message);
                        return null;
                    }
                }

                return parsed;
            }

            return this.error(`Unknown expression "${op}". If you wanted a literal array, use ["literal", [...]].`, 0);
        } else if (typeof expr === 'undefined') {
            return this.error(`'undefined' value invalid. Use null instead.`);
        } else if (typeof expr === 'object') {
            return this.error(`Bare objects invalid. Use ["literal", {...}] instead.`);
        } else {
            return this.error(`Expected an array, but found ${typeof expr} instead.`);
        }
    }

    /**
     * Returns a copy of this context suitable for parsing the subexpression at
     * index `index`, optionally appending to 'let' binding map.
     *
     * Note that `errors` property, intended for collecting errors while
     * parsing, is copied by reference rather than cloned.
     * @private
     */
    concat(index: number, expectedType?: ?Type, bindings?: Array<[string, Expression]>) {
        const path = typeof index === 'number' ? this.path.concat(index) : this.path;
        const scope = bindings ? this.scope.concat(bindings) : this.scope;
        return new ParsingContext(
            this.registry,
            path,
            expectedType || null,
            scope,
            this.errors
        );
    }

    /**
     * Push a parsing (or type checking) error into the `this.errors`
     * @param error The message
     * @param keys Optionally specify the source of the error at a child
     * of the current expression at `this.key`.
     * @private
     */
    error(error: string, ...keys: Array<number>) {
        const key = `${this.key}${keys.map(k => `[${k}]`).join('')}`;
        this.errors.push(new ParsingError(key, error));
    }

    /**
     * Returns null if `t` is a subtype of `expected`; otherwise returns an
     * error message and also pushes it to `this.errors`.
     */
    checkSubtype(expected: Type, t: Type): ?string {
        const error = checkSubtype(expected, t);
        if (error) this.error(error);
        return error;
    }
}

export default ParsingContext;

function isConstant(expression: Expression) {
    if (expression instanceof Var) {
        return isConstant(expression.boundExpression);
    } else if (expression instanceof CompoundExpression && expression.name === 'error') {
        return false;
    } else if (expression instanceof CollatorExpression) {
        // Although the results of a Collator expression with fixed arguments
        // generally shouldn't change between executions, we can't serialize them
        // as constant expressions because results change based on environment.
        return false;
    }

    const isTypeAnnotation = expression instanceof Coercion ||
        expression instanceof Assertion;

    let childrenConstant = true;
    expression.eachChild(child => {
        // We can _almost_ assume that if `expressions` children are constant,
        // they would already have been evaluated to Literal values when they
        // were parsed.  Type annotations are the exception, because they might
        // have been inferred and added after a child was parsed.

        // So we recurse into isConstant() for the children of type annotations,
        // but otherwise simply check whether they are Literals.
        if (isTypeAnnotation) {
            childrenConstant = childrenConstant && isConstant(child);
        } else {
            childrenConstant = childrenConstant && child instanceof Literal;
        }
    });
    if (!childrenConstant) {
        return false;
    }

    return isFeatureConstant(expression) &&
        isGlobalPropertyConstant(expression, ['zoom', 'heatmap-density', 'line-progress', 'accumulated', 'is-supported-script']);
}
