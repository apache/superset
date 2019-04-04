// @flow

import assert from 'assert';

import { typeOf } from '../values';
import { ValueType, type Type } from '../types';

import type { Expression } from '../expression';
import type ParsingContext from '../parsing_context';
import type EvaluationContext from '../evaluation_context';
import type { Value } from '../values';

// Map input label values to output expression index
type Cases = {[number | string]: number};

class Match implements Expression {
    type: Type;
    inputType: Type;

    input: Expression;
    cases: Cases;
    outputs: Array<Expression>;
    otherwise: Expression;

    constructor(inputType: Type, outputType: Type, input: Expression, cases: Cases, outputs: Array<Expression>, otherwise: Expression) {
        this.inputType = inputType;
        this.type = outputType;
        this.input = input;
        this.cases = cases;
        this.outputs = outputs;
        this.otherwise = otherwise;
    }

    static parse(args: Array<mixed>, context: ParsingContext) {
        if (args.length < 5)
            return context.error(`Expected at least 4 arguments, but found only ${args.length - 1}.`);
        if (args.length % 2 !== 1)
            return context.error(`Expected an even number of arguments.`);

        let inputType;
        let outputType;
        if (context.expectedType && context.expectedType.kind !== 'value') {
            outputType = context.expectedType;
        }
        const cases = {};
        const outputs = [];
        for (let i = 2; i < args.length - 1; i += 2) {
            let labels = args[i];
            const value = args[i + 1];

            if (!Array.isArray(labels)) {
                labels = [labels];
            }

            const labelContext = context.concat(i);
            if (labels.length === 0) {
                return labelContext.error('Expected at least one branch label.');
            }

            for (const label of labels) {
                if (typeof label !== 'number' && typeof label !== 'string') {
                    return labelContext.error(`Branch labels must be numbers or strings.`);
                } else if (typeof label === 'number' && Math.abs(label) > Number.MAX_SAFE_INTEGER) {
                    return labelContext.error(`Branch labels must be integers no larger than ${Number.MAX_SAFE_INTEGER}.`);

                } else if (typeof label === 'number' && Math.floor(label) !== label) {
                    return labelContext.error(`Numeric branch labels must be integer values.`);

                } else if (!inputType) {
                    inputType = typeOf(label);
                } else if (labelContext.checkSubtype(inputType, typeOf(label))) {
                    return null;
                }

                if (typeof cases[String(label)] !== 'undefined') {
                    return labelContext.error('Branch labels must be unique.');
                }

                cases[String(label)] = outputs.length;
            }

            const result = context.parse(value, i, outputType);
            if (!result) return null;
            outputType = outputType || result.type;
            outputs.push(result);
        }

        const input = context.parse(args[1], 1, ValueType);
        if (!input) return null;

        const otherwise = context.parse(args[args.length - 1], args.length - 1, outputType);
        if (!otherwise) return null;

        assert(inputType && outputType);

        if (input.type.kind !== 'value' && context.concat(1).checkSubtype((inputType: any), input.type)) {
            return null;
        }

        return new Match((inputType: any), (outputType: any), input, cases, outputs, otherwise);
    }

    evaluate(ctx: EvaluationContext) {
        const input = (this.input.evaluate(ctx): any);
        const output = (typeOf(input) === this.inputType && this.outputs[this.cases[input]]) || this.otherwise;
        return output.evaluate(ctx);
    }

    eachChild(fn: (Expression) => void) {
        fn(this.input);
        this.outputs.forEach(fn);
        fn(this.otherwise);
    }

    possibleOutputs(): Array<Value | void> {
        return []
            .concat(...this.outputs.map((out) => out.possibleOutputs()))
            .concat(this.otherwise.possibleOutputs());
    }

    serialize(): Array<mixed> {
        const serialized = ["match", this.input.serialize()];

        // Sort so serialization has an arbitrary defined order, even though
        // branch order doesn't affect evaluation
        const sortedLabels = Object.keys(this.cases).sort();

        // Group branches by unique match expression to support condensed
        // serializations of the form [case1, case2, ...] -> matchExpression
        const groupedByOutput: Array<[number, Array<number | string>]> = [];
        const outputLookup: {[index: number]: number} = {}; // lookup index into groupedByOutput for a given output expression
        for (const label of sortedLabels) {
            const outputIndex = outputLookup[this.cases[label]];
            if (outputIndex === undefined) {
                // First time seeing this output, add it to the end of the grouped list
                outputLookup[this.cases[label]] = groupedByOutput.length;
                groupedByOutput.push([this.cases[label], [label]]);
            } else {
                // We've seen this expression before, add the label to that output's group
                groupedByOutput[outputIndex][1].push(label);
            }
        }

        const coerceLabel = (label) => this.inputType.kind === 'number' ? Number(label) : label;

        for (const [outputIndex, labels] of groupedByOutput) {
            if (labels.length === 1) {
                // Only a single label matches this output expression
                serialized.push(coerceLabel(labels[0]));
            } else {
                // Array of literal labels pointing to this output expression
                serialized.push(labels.map(coerceLabel));
            }
            serialized.push(this.outputs[outputIndex].serialize());
        }
        serialized.push(this.otherwise.serialize());
        return serialized;
    }
}

export default Match;
