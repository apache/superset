// Type definitions for fast-json-stable-stringify 2.0
// Project: https://github.com/epoberezkin/fast-json-stable-stringify
// Definitions by: BendingBender <https://github.com/BendingBender>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

export = stringify;

declare function stringify(obj: any, options?: stringify.Options | stringify.Comparator): string;

declare namespace stringify {
    interface Options {
        cmp?: (a: CompareDescriptor, b: CompareDescriptor) => number;
        cycles?: boolean;
    }

    type Comparator = (a: CompareDescriptor, b: CompareDescriptor) => number;

    interface CompareDescriptor {
        key: string;
        value: any;
    }
}
