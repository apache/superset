// @flow

import { NumberType, ValueType, FormattedType, array, StringType } from '../types';
import Formatted, { FormattedSection } from '../types/formatted';
import { toString } from '../values';

import type { Expression } from '../expression';
import type EvaluationContext from '../evaluation_context';
import type ParsingContext from '../parsing_context';
import type { Type } from '../types';

type FormattedSectionExpression = {
    text: Expression,
    scale: Expression | null;
    font: Expression | null;
}

export default class FormatExpression implements Expression {
    type: Type;
    sections: Array<FormattedSectionExpression>;

    constructor(sections: Array<FormattedSectionExpression>) {
        this.type = FormattedType;
        this.sections = sections;
    }

    static parse(args: Array<mixed>, context: ParsingContext): ?Expression {
        if (args.length < 3) {
            return context.error(`Expected at least two arguments.`);
        }

        if ((args.length - 1) % 2 !== 0) {
            return context.error(`Expected an even number of arguments.`);
        }

        const sections: Array<FormattedSectionExpression> = [];
        for (let i = 1; i < args.length - 1; i += 2) {
            const text = context.parse(args[i], 1, ValueType);
            if (!text) return null;
            const kind = text.type.kind;
            if (kind !== 'string' && kind !== 'value' && kind !== 'null')
                return context.error(`Formatted text type must be 'string', 'value', or 'null'.`);

            const options = (args[i + 1]: any);
            if (typeof options !== "object" || Array.isArray(options))
                return context.error(`Format options argument must be an object.`);

            let scale = null;
            if (options['font-scale']) {
                scale = context.parse(options['font-scale'], 1, NumberType);
                if (!scale) return null;
            }

            let font = null;
            if (options['text-font']) {
                font = context.parse(options['text-font'], 1, array(StringType));
                if (!font) return null;
            }
            sections.push({text, scale, font});
        }

        return new FormatExpression(sections);
    }

    evaluate(ctx: EvaluationContext) {
        return new Formatted(
            this.sections.map(section =>
                new FormattedSection(
                    toString(section.text.evaluate(ctx)),
                    section.scale ? section.scale.evaluate(ctx) : null,
                    section.font ? section.font.evaluate(ctx).join(',') : null
                )
            )
        );
    }

    eachChild(fn: (Expression) => void) {
        for (const section of this.sections) {
            fn(section.text);
            if (section.scale) {
                fn(section.scale);
            }
            if (section.font) {
                fn(section.font);
            }
        }
    }

    possibleOutputs() {
        // Technically the combinatoric set of all children
        // Usually, this.text will be undefined anyway
        return [undefined];
    }

    serialize() {
        const serialized = ["format"];
        for (const section of this.sections) {
            serialized.push(section.text.serialize());
            const options = {};
            if (section.scale) {
                options['font-scale'] = section.scale.serialize();
            }
            if (section.font) {
                options['text-font'] = section.font.serialize();
            }
            serialized.push(options);
        }
        return serialized;
    }
}
