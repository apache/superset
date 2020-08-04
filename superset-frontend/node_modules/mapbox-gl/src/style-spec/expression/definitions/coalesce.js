// @flow

import assert from 'assert';

import { checkSubtype, ValueType } from '../types';

import type { Expression } from '../expression';
import type ParsingContext from '../parsing_context';
import type EvaluationContext from '../evaluation_context';
import type { Value } from '../values';
import type { Type } from '../types';

class Coalesce implements Expression {
    type: Type;
    args: Array<Expression>;

    constructor(type: Type, args: Array<Expression>) {
        this.type = type;
        this.args = args;
    }

    static parse(args: Array<mixed>, context: ParsingContext) {
        if (args.length < 2) {
            return context.error("Expectected at least one argument.");
        }
        let outputType: Type = (null: any);
        const expectedType = context.expectedType;
        if (expectedType && expectedType.kind !== 'value') {
            outputType = expectedType;
        }
        const parsedArgs = [];

        for (const arg of args.slice(1)) {
            const parsed = context.parse(arg, 1 + parsedArgs.length, outputType, undefined, {typeAnnotation: 'omit'});
            if (!parsed) return null;
            outputType = outputType || parsed.type;
            parsedArgs.push(parsed);
        }
        assert(outputType);

        // Above, we parse arguments without inferred type annotation so that
        // they don't produce a runtime error for `null` input, which would
        // preempt the desired null-coalescing behavior.
        // Thus, if any of our arguments would have needed an annotation, we
        // need to wrap the enclosing coalesce expression with it instead.
        const needsAnnotation = expectedType &&
            parsedArgs.some(arg => checkSubtype(expectedType, arg.type));

        return needsAnnotation ?
            new Coalesce(ValueType, parsedArgs) :
            new Coalesce((outputType: any), parsedArgs);
    }

    evaluate(ctx: EvaluationContext) {
        let result = null;
        for (const arg of this.args) {
            result = arg.evaluate(ctx);
            if (result !== null) break;
        }
        return result;
    }

    eachChild(fn: (Expression) => void) {
        this.args.forEach(fn);
    }

    possibleOutputs(): Array<Value | void> {
        return [].concat(...this.args.map((arg) => arg.possibleOutputs()));
    }

    serialize() {
        const serialized = ["coalesce"];
        this.eachChild(child => { serialized.push(child.serialize()); });
        return serialized;
    }
}

export default Coalesce;
