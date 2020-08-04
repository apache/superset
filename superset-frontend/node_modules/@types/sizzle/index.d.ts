// Type definitions for sizzle 2.3
// Project: https://sizzlejs.com
// Definitions by: Leonard Thieu <https://github.com/leonard-thieu>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 2.3

export as namespace Sizzle;

declare const Sizzle: SizzleStatic;
export = Sizzle;

interface SizzleStatic {
    selectors: Sizzle.Selectors;
    <TArrayLike extends ArrayLike<Element>>(selector: string, context: Element | Document | DocumentFragment, results: TArrayLike): TArrayLike;
    (selector: string, context?: Element | Document | DocumentFragment): Element[];
    // tslint:disable-next-line:ban-types
    compile(selector: string): Function;
    matchSelector(element: Element, selector: string): boolean;
    matches(selector: string, elements: Element[]): Element[];
}

declare namespace Sizzle {
    interface Selectors {
        cacheLength: number;
        match: Selectors.Matches;
        find: Selectors.FindFunctions;
        preFilter: Selectors.PreFilterFunctions;
        filter: Selectors.FilterFunctions;
        attrHandle: Selectors.AttrHandleFunctions;
        pseudos: Selectors.PseudoFunctions;
        setFilters: Selectors.SetFilterFunctions;
        createPseudo(fn: Selectors.CreatePseudoFunction): Selectors.PseudoFunction;
    }

    namespace Selectors {
        interface Matches {
            [name: string]: RegExp;
        }

        interface FindFunction {
            (match: RegExpMatchArray, context: Element | Document, isXML: boolean): Element[] | void;
        }

        interface FindFunctions {
            [name: string]: FindFunction;
        }

        interface PreFilterFunction {
            (match: RegExpMatchArray): string[];
        }

        interface PreFilterFunctions {
            [name: string]: PreFilterFunction;
        }

        interface FilterFunction {
            (element: string, ...matches: string[]): boolean;
        }

        interface FilterFunctions {
            [name: string]: FilterFunction;
        }

        interface AttrHandleFunction {
            (elem: any, casePreservedName: string, isXML: boolean): string;
        }

        interface AttrHandleFunctions {
            [name: string]: AttrHandleFunction;
        }

        interface PseudoFunction {
            (elem: Element): boolean;
        }

        interface PseudoFunctions {
            [name: string]: PseudoFunction;
        }

        interface SetFilterFunction {
            (elements: Element[], argument: number, not: boolean): Element[];
        }

        interface SetFilterFunctions {
            [name: string]: SetFilterFunction;
        }

        interface CreatePseudoFunction {
            (...args: any[]): PseudoFunction;
        }
    }
}
