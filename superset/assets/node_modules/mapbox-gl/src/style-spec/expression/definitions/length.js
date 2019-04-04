// @flow

import { NumberType, toString } from '../types';

import { typeOf } from '../values';
import RuntimeError from '../runtime_error';

import type { Expression } from '../expression';
import type ParsingContext from '../parsing_context';
import type EvaluationContext from '../evaluation_context';
import type { Type } from '../types';

class Length implements Expression {
    type: Type;
    input: Expression;

    constructor(input: Expression) {
        this.type = NumberType;
        this.input = input;
    }

    static parse(args: Array<mixed>, context: ParsingContext) {
        if (args.length !== 2)
            return context.error(`Expected 1 argument, but found ${args.length - 1} instead.`);

        const input = context.parse(args[1], 1);
        if (!input) return null;

        if (input.type.kind !== 'array' && input.type.kind !== 'string' && input.type.kind !== 'value')
            return context.error(`Expected argument of type string or array, but found ${toString(input.type)} instead.`);

        return new Length(input);
    }

    evaluate(ctx: EvaluationContext) {
        const input = this.input.evaluate(ctx);
        if (typeof input === 'string') {
            return input.length;
        } else if (Array.isArray(input)) {
            return input.length;
        } else {
            throw new RuntimeError(`Expected value to be of type string or array, but found ${toString(typeOf(input))} instead.`);
        }
    }

    eachChild(fn: (Expression) => void) {
        fn(this.input);
    }

    possibleOutputs() {
        return [undefined];
    }

    serialize() {
        const serialized = ["length"];
        this.eachChild(child => { serialized.push(child.serialize()); });
        return serialized;
    }
}

export default Length;
