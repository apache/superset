// @flow

import type {Type} from './types';
import type {Value} from './values';
import type ParsingContext from './parsing_context';
import type EvaluationContext from './evaluation_context';

type SerializedExpression = Array<mixed> | string | number | boolean | null;

export interface Expression {
    +type: Type;

    evaluate(ctx: EvaluationContext): any;

    eachChild(fn: Expression => void): void;

    /**
     * Statically analyze the expression, attempting to enumerate possible outputs. Returns
     * an array of values plus the sentinel value `undefined`, used to indicate that the
     * complete set of outputs is statically undecidable.
     */
    possibleOutputs(): Array<Value | void>;

    serialize(): SerializedExpression;
}

export type ExpressionParser = (args: Array<mixed>, context: ParsingContext) => ?Expression;
export type ExpressionRegistration = Class<Expression> & { +parse: ExpressionParser };
export type ExpressionRegistry = {[string]: ExpressionRegistration};
