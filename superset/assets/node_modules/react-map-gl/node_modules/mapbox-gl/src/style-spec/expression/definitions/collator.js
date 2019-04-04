// @flow

import { StringType, BooleanType, CollatorType } from '../types';
import Collator from '../types/collator';

import type { Expression } from '../expression';
import type EvaluationContext from '../evaluation_context';
import type ParsingContext from '../parsing_context';
import type { Type } from '../types';

export default class CollatorExpression implements Expression {
    type: Type;
    caseSensitive: Expression;
    diacriticSensitive: Expression;
    locale: Expression | null;

    constructor(caseSensitive: Expression, diacriticSensitive: Expression, locale: Expression | null) {
        this.type = CollatorType;
        this.locale = locale;
        this.caseSensitive = caseSensitive;
        this.diacriticSensitive = diacriticSensitive;
    }

    static parse(args: Array<mixed>, context: ParsingContext): ?Expression {
        if (args.length !== 2)
            return context.error(`Expected one argument.`);

        const options = (args[1]: any);
        if (typeof options !== "object" || Array.isArray(options))
            return context.error(`Collator options argument must be an object.`);

        const caseSensitive = context.parse(
            options['case-sensitive'] === undefined ? false : options['case-sensitive'], 1, BooleanType);
        if (!caseSensitive) return null;

        const diacriticSensitive = context.parse(
            options['diacritic-sensitive'] === undefined ? false : options['diacritic-sensitive'], 1, BooleanType);
        if (!diacriticSensitive) return null;

        let locale = null;
        if (options['locale']) {
            locale = context.parse(options['locale'], 1, StringType);
            if (!locale) return null;
        }

        return new CollatorExpression(caseSensitive, diacriticSensitive, locale);
    }

    evaluate(ctx: EvaluationContext) {
        return new Collator(this.caseSensitive.evaluate(ctx), this.diacriticSensitive.evaluate(ctx), this.locale ? this.locale.evaluate(ctx) : null);
    }

    eachChild(fn: (Expression) => void) {
        fn(this.caseSensitive);
        fn(this.diacriticSensitive);
        if (this.locale) {
            fn(this.locale);
        }
    }

    possibleOutputs() {
        // Technically the set of possible outputs is the combinatoric set of Collators produced
        // by all possibleOutputs of locale/caseSensitive/diacriticSensitive
        // But for the primary use of Collators in comparison operators, we ignore the Collator's
        // possibleOutputs anyway, so we can get away with leaving this undefined for now.
        return [undefined];
    }

    serialize() {
        const options = {};
        options['case-sensitive'] = this.caseSensitive.serialize();
        options['diacritic-sensitive'] = this.diacriticSensitive.serialize();
        if (this.locale) {
            options['locale'] = this.locale.serialize();
        }
        return ["collator", options];
    }
}
