// Type definitions for anymatch 1.3
// Project: https://github.com/micromatch/anymatch
// Definitions by: BendingBender <https://github.com/BendingBender>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

export = anymatch;

declare function anymatch(matcher: anymatch.Matcher): CurrriedMatcher;
declare function anymatch(matcher: anymatch.Matcher, testString: string | string[], returnIndex: true, startIndex?: number, endIndex?: number): number;
declare function anymatch(matcher: anymatch.Matcher, testString: string | string[], returnIndex?: boolean, startIndex?: number, endIndex?: number): boolean;

declare namespace anymatch {
    type Matcher = MatcherType | MatcherType[];
    type MatcherType = string | RegExp | ((...testStrings: string[]) => boolean);
}

interface CurrriedMatcher {
    (testString: string | string[], returnIndex: true, startIndex?: number, endIndex?: number): number;
    (testString: string | string[], returnIndex?: boolean, startIndex?: number, endIndex?: number): boolean;
}
