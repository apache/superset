// @flow

import type { Type } from '../types';
import type { Expression } from '../expression';
import type ParsingContext from '../parsing_context';
import type EvaluationContext  from '../evaluation_context';

class Let implements Expression {
    type: Type;
    bindings: Array<[string, Expression]>;
    result: Expression;

    constructor(bindings: Array<[string, Expression]>, result: Expression) {
        this.type = result.type;
        this.bindings = [].concat(bindings);
        this.result = result;
    }

    evaluate(ctx: EvaluationContext) {
        return this.result.evaluate(ctx);
    }

    eachChild(fn: (Expression) => void) {
        for (const binding of this.bindings) {
            fn(binding[1]);
        }
        fn(this.result);
    }

    static parse(args: Array<mixed>, context: ParsingContext) {
        if (args.length < 4)
            return context.error(`Expected at least 3 arguments, but found ${args.length - 1} instead.`);

        const bindings: Array<[string, Expression]> = [];
        for (let i = 1; i < args.length - 1; i += 2) {
            const name = args[i];

            if (typeof name !== 'string') {
                return context.error(`Expected string, but found ${typeof name} instead.`, i);
            }

            if (/[^a-zA-Z0-9_]/.test(name)) {
                return context.error(`Variable names must contain only alphanumeric characters or '_'.`, i);
            }

            const value = context.parse(args[i + 1], i + 1);
            if (!value) return null;

            bindings.push([name, value]);
        }

        const result = context.parse(args[args.length - 1], args.length - 1, context.expectedType, bindings);
        if (!result) return null;

        return new Let(bindings, result);
    }

    possibleOutputs() {
        return this.result.possibleOutputs();
    }

    serialize() {
        const serialized = ["let"];
        for (const [name, expr] of this.bindings) {
            serialized.push(name, expr.serialize());
        }
        serialized.push(this.result.serialize());
        return serialized;
    }
}

export default Let;
