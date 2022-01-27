export namespace aggregatorTemplates {
    export function countUnique(f: any): ([attr]: [any]) => () => {
        uniq: never[];
        push(record: any): void;
        value(): any;
        format: (x: any) => string;
        numInputs: number;
    };
    export function countUnique(f: any): ([attr]: [any]) => () => {
        uniq: never[];
        push(record: any): void;
        value(): any;
        format: (x: any) => string;
        numInputs: number;
    };
    export function listUnique(s: any, f: any): ([attr]: [any]) => () => {
        uniq: never[];
        push(record: any): void;
        value(): any;
        format: (x: any) => string;
        numInputs: number;
    };
    export function listUnique(s: any, f: any): ([attr]: [any]) => () => {
        uniq: never[];
        push(record: any): void;
        value(): any;
        format: (x: any) => string;
        numInputs: number;
    };
    export function max(f: any): ([attr]: [any]) => (data: any) => {
        val: null;
        sorter: any;
        push(record: any): void;
        value(): null;
        format(x: any): any;
        numInputs: number;
    };
    export function max(f: any): ([attr]: [any]) => (data: any) => {
        val: null;
        sorter: any;
        push(record: any): void;
        value(): null;
        format(x: any): any;
        numInputs: number;
    };
    export function min(f: any): ([attr]: [any]) => (data: any) => {
        val: null;
        sorter: any;
        push(record: any): void;
        value(): null;
        format(x: any): any;
        numInputs: number;
    };
    export function min(f: any): ([attr]: [any]) => (data: any) => {
        val: null;
        sorter: any;
        push(record: any): void;
        value(): null;
        format(x: any): any;
        numInputs: number;
    };
    export function first(f: any): ([attr]: [any]) => (data: any) => {
        val: null;
        sorter: any;
        push(record: any): void;
        value(): null;
        format(x: any): any;
        numInputs: number;
    };
    export function first(f: any): ([attr]: [any]) => (data: any) => {
        val: null;
        sorter: any;
        push(record: any): void;
        value(): null;
        format(x: any): any;
        numInputs: number;
    };
    export function last(f: any): ([attr]: [any]) => (data: any) => {
        val: null;
        sorter: any;
        push(record: any): void;
        value(): null;
        format(x: any): any;
        numInputs: number;
    };
    export function last(f: any): ([attr]: [any]) => (data: any) => {
        val: null;
        sorter: any;
        push(record: any): void;
        value(): null;
        format(x: any): any;
        numInputs: number;
    };
    export function median(f: any): ([attr]: [any]) => () => {
        vals: never[];
        push(record: any): void;
        value(): number | null;
        format: (x: any) => string;
        numInputs: number;
    };
    export function median(f: any): ([attr]: [any]) => () => {
        vals: never[];
        push(record: any): void;
        value(): number | null;
        format: (x: any) => string;
        numInputs: number;
    };
    export function average(f: any): ([attr]: [any]) => () => {
        n: number;
        m: number;
        s: number;
        push(record: any): void;
        value(): number;
        format: (x: any) => string;
        numInputs: number;
    };
    export function average(f: any): ([attr]: [any]) => () => {
        n: number;
        m: number;
        s: number;
        push(record: any): void;
        value(): number;
        format: (x: any) => string;
        numInputs: number;
    };
    function _var(ddof: any, f: any): ([attr]: [any]) => () => {
        n: number;
        m: number;
        s: number;
        push(record: any): void;
        value(): number;
        format: (x: any) => string;
        numInputs: number;
    };
    export function _var(ddof: any, f: any): ([attr]: [any]) => () => {
        n: number;
        m: number;
        s: number;
        push(record: any): void;
        value(): number;
        format: (x: any) => string;
        numInputs: number;
    };
    export { _var as var };
    export function stdev(ddof: any, f: any): ([attr]: [any]) => () => {
        n: number;
        m: number;
        s: number;
        push(record: any): void;
        value(): number;
        format: (x: any) => string;
        numInputs: number;
    };
    export function stdev(ddof: any, f: any): ([attr]: [any]) => () => {
        n: number;
        m: number;
        s: number;
        push(record: any): void;
        value(): number;
        format: (x: any) => string;
        numInputs: number;
    };
    export function count(formatter?: (x: any) => string): () => () => {
        count: number;
        push(): void;
        value(): number;
        format: (x: any) => string;
    };
    export function count(formatter?: (x: any) => string): () => () => {
        count: number;
        push(): void;
        value(): number;
        format: (x: any) => string;
    };
    export function uniques(fn: any, formatter?: (x: any) => string): ([attr]: [any]) => () => {
        uniq: never[];
        push(record: any): void;
        value(): any;
        format: (x: any) => string;
        numInputs: number;
    };
    export function uniques(fn: any, formatter?: (x: any) => string): ([attr]: [any]) => () => {
        uniq: never[];
        push(record: any): void;
        value(): any;
        format: (x: any) => string;
        numInputs: number;
    };
    export function sum(formatter?: (x: any) => string): ([attr]: [any]) => () => {
        sum: number;
        push(record: any): void;
        value(): number;
        format: (x: any) => string;
        numInputs: number;
    };
    export function sum(formatter?: (x: any) => string): ([attr]: [any]) => () => {
        sum: number;
        push(record: any): void;
        value(): number;
        format: (x: any) => string;
        numInputs: number;
    };
    export function extremes(mode: any, formatter?: (x: any) => string): ([attr]: [any]) => (data: any) => {
        val: null;
        sorter: any;
        push(record: any): void;
        value(): null;
        format(x: any): any;
        numInputs: number;
    };
    export function extremes(mode: any, formatter?: (x: any) => string): ([attr]: [any]) => (data: any) => {
        val: null;
        sorter: any;
        push(record: any): void;
        value(): null;
        format(x: any): any;
        numInputs: number;
    };
    export function quantile(q: any, formatter?: (x: any) => string): ([attr]: [any]) => () => {
        vals: never[];
        push(record: any): void;
        value(): number | null;
        format: (x: any) => string;
        numInputs: number;
    };
    export function quantile(q: any, formatter?: (x: any) => string): ([attr]: [any]) => () => {
        vals: never[];
        push(record: any): void;
        value(): number | null;
        format: (x: any) => string;
        numInputs: number;
    };
    export function runningStat(mode?: string, ddof?: number, formatter?: (x: any) => string): ([attr]: [any]) => () => {
        n: number;
        m: number;
        s: number;
        push(record: any): void;
        value(): number;
        format: (x: any) => string;
        numInputs: number;
    };
    export function runningStat(mode?: string, ddof?: number, formatter?: (x: any) => string): ([attr]: [any]) => () => {
        n: number;
        m: number;
        s: number;
        push(record: any): void;
        value(): number;
        format: (x: any) => string;
        numInputs: number;
    };
    export function sumOverSum(formatter?: (x: any) => string): ([num, denom]: [any, any]) => () => {
        sumNum: number;
        sumDenom: number;
        push(record: any): void;
        value(): number;
        format: (x: any) => string;
        numInputs: number;
    };
    export function sumOverSum(formatter?: (x: any) => string): ([num, denom]: [any, any]) => () => {
        sumNum: number;
        sumDenom: number;
        push(record: any): void;
        value(): number;
        format: (x: any) => string;
        numInputs: number;
    };
    export function fractionOf(wrapped: any, type?: string, formatter?: (x: any) => string): (...x: any[]) => (data: any, rowKey: any, colKey: any) => {
        selector: any[] | never[][] | undefined;
        inner: any;
        push(record: any): void;
        format: (x: any) => string;
        value(): number;
        numInputs: any;
    };
    export function fractionOf(wrapped: any, type?: string, formatter?: (x: any) => string): (...x: any[]) => (data: any, rowKey: any, colKey: any) => {
        selector: any[] | never[][] | undefined;
        inner: any;
        push(record: any): void;
        format: (x: any) => string;
        value(): number;
        numInputs: any;
    };
}
export const aggregators: {
    Count: () => () => {
        count: number;
        push(): void;
        value(): number;
        format: (x: any) => string;
    };
    'Count Unique Values': ([attr]: [any]) => () => {
        uniq: never[];
        push(record: any): void;
        value(): any;
        format: (x: any) => string;
        numInputs: number;
    };
    'List Unique Values': ([attr]: [any]) => () => {
        uniq: never[];
        push(record: any): void;
        value(): any;
        format: (x: any) => string;
        numInputs: number;
    };
    Sum: ([attr]: [any]) => () => {
        sum: number;
        push(record: any): void;
        value(): number;
        format: (x: any) => string;
        numInputs: number;
    };
    'Integer Sum': ([attr]: [any]) => () => {
        sum: number;
        push(record: any): void;
        value(): number;
        format: (x: any) => string;
        numInputs: number;
    };
    Average: ([attr]: [any]) => () => {
        n: number;
        m: number;
        s: number;
        push(record: any): void;
        value(): number;
        format: (x: any) => string;
        numInputs: number;
    };
    Median: ([attr]: [any]) => () => {
        vals: never[];
        push(record: any): void;
        value(): number | null;
        format: (x: any) => string;
        numInputs: number;
    };
    'Sample Variance': ([attr]: [any]) => () => {
        n: number;
        m: number;
        s: number;
        push(record: any): void;
        value(): number;
        format: (x: any) => string;
        numInputs: number;
    };
    'Sample Standard Deviation': ([attr]: [any]) => () => {
        n: number;
        m: number;
        s: number;
        push(record: any): void;
        value(): number;
        format: (x: any) => string;
        numInputs: number;
    };
    Minimum: ([attr]: [any]) => (data: any) => {
        val: null;
        sorter: any;
        push(record: any): void;
        value(): null;
        format(x: any): any;
        numInputs: number;
    };
    Maximum: ([attr]: [any]) => (data: any) => {
        val: null;
        sorter: any;
        push(record: any): void;
        value(): null;
        format(x: any): any;
        numInputs: number;
    };
    First: ([attr]: [any]) => (data: any) => {
        val: null;
        sorter: any;
        push(record: any): void;
        value(): null;
        format(x: any): any;
        numInputs: number;
    };
    Last: ([attr]: [any]) => (data: any) => {
        val: null;
        sorter: any;
        push(record: any): void;
        value(): null;
        format(x: any): any;
        numInputs: number;
    };
    'Sum over Sum': ([num, denom]: [any, any]) => () => {
        sumNum: number;
        sumDenom: number;
        push(record: any): void;
        value(): number;
        format: (x: any) => string;
        numInputs: number;
    };
    'Sum as Fraction of Total': (...x: any[]) => (data: any, rowKey: any, colKey: any) => {
        selector: any[] | never[][] | undefined;
        inner: any;
        push(record: any): void;
        format: (x: any) => string;
        value(): number;
        numInputs: any;
    };
    'Sum as Fraction of Rows': (...x: any[]) => (data: any, rowKey: any, colKey: any) => {
        selector: any[] | never[][] | undefined;
        inner: any;
        push(record: any): void;
        format: (x: any) => string;
        value(): number;
        numInputs: any;
    };
    'Sum as Fraction of Columns': (...x: any[]) => (data: any, rowKey: any, colKey: any) => {
        selector: any[] | never[][] | undefined;
        inner: any;
        push(record: any): void;
        format: (x: any) => string;
        value(): number;
        numInputs: any;
    };
    'Count as Fraction of Total': (...x: any[]) => (data: any, rowKey: any, colKey: any) => {
        selector: any[] | never[][] | undefined;
        inner: any;
        push(record: any): void;
        format: (x: any) => string;
        value(): number;
        numInputs: any;
    };
    'Count as Fraction of Rows': (...x: any[]) => (data: any, rowKey: any, colKey: any) => {
        selector: any[] | never[][] | undefined;
        inner: any;
        push(record: any): void;
        format: (x: any) => string;
        value(): number;
        numInputs: any;
    };
    'Count as Fraction of Columns': (...x: any[]) => (data: any, rowKey: any, colKey: any) => {
        selector: any[] | never[][] | undefined;
        inner: any;
        push(record: any): void;
        format: (x: any) => string;
        value(): number;
        numInputs: any;
    };
};
export namespace derivers {
    function bin(col: any, binWidth: any): (record: any) => number;
    function bin(col: any, binWidth: any): (record: any) => number;
    function dateFormat(col: any, formatString: any, utcOutput?: boolean, mthNames?: string[], dayNames?: string[]): (record: any) => any;
    function dateFormat(col: any, formatString: any, utcOutput?: boolean, mthNames?: string[], dayNames?: string[]): (record: any) => any;
}
export namespace locales {
    namespace en {
        export { aggregators };
        export namespace localeStrings {
            const renderError: string;
            const computeError: string;
            const uiRenderError: string;
            const selectAll: string;
            const selectNone: string;
            const tooMany: string;
            const filterResults: string;
            const apply: string;
            const cancel: string;
            const totals: string;
            const vs: string;
            const by: string;
        }
    }
}
export function naturalSort(as: any, bs: any): number;
export function numberFormat(optsIn: any): (x: any) => string;
export function getSort(sorters: any, attr: any): any;
export function sortAs(order: any): (a: any, b: any) => number;
export function flatKey(attrVals: any): any;
export class PivotData {
    constructor(inputProps?: {}, subtotals?: {});
    props: {
        aggregators: {
            Count: () => () => {
                count: number;
                push(): void;
                value(): number;
                format: (x: any) => string;
            };
            'Count Unique Values': ([attr]: [any]) => () => {
                uniq: never[];
                push(record: any): void;
                value(): any;
                format: (x: any) => string;
                numInputs: number;
            };
            'List Unique Values': ([attr]: [any]) => () => {
                uniq: never[];
                push(record: any): void;
                value(): any;
                format: (x: any) => string;
                numInputs: number;
            };
            Sum: ([attr]: [any]) => () => {
                sum: number;
                push(record: any): void;
                value(): number;
                format: (x: any) => string;
                numInputs: number;
            };
            'Integer Sum': ([attr]: [any]) => () => {
                sum: number;
                push(record: any): void;
                value(): number;
                format: (x: any) => string;
                numInputs: number;
            };
            Average: ([attr]: [any]) => () => {
                n: number;
                m: number;
                s: number;
                push(record: any): void;
                value(): number;
                format: (x: any) => string;
                numInputs: number;
            };
            Median: ([attr]: [any]) => () => {
                vals: never[];
                push(record: any): void;
                value(): number | null;
                format: (x: any) => string;
                numInputs: number;
            };
            'Sample Variance': ([attr]: [any]) => () => {
                n: number;
                m: number;
                s: number;
                push(record: any): void;
                value(): number;
                format: (x: any) => string;
                numInputs: number;
            };
            'Sample Standard Deviation': ([attr]: [any]) => () => {
                n: number;
                m: number;
                s: number;
                push(record: any): void;
                value(): number;
                format: (x: any) => string;
                numInputs: number;
            };
            Minimum: ([attr]: [any]) => (data: any) => {
                val: null;
                sorter: any;
                push(record: any): void;
                value(): null;
                format(x: any): any;
                numInputs: number;
            };
            Maximum: ([attr]: [any]) => (data: any) => {
                val: null;
                sorter: any;
                push(record: any): void;
                value(): null;
                format(x: any): any;
                numInputs: number;
            };
            First: ([attr]: [any]) => (data: any) => {
                val: null;
                sorter: any;
                push(record: any): void;
                value(): null;
                format(x: any): any;
                numInputs: number;
            };
            Last: ([attr]: [any]) => (data: any) => {
                val: null;
                sorter: any;
                push(record: any): void;
                value(): null;
                format(x: any): any;
                numInputs: number;
            };
            'Sum over Sum': ([num, denom]: [any, any]) => () => {
                sumNum: number;
                sumDenom: number;
                push(record: any): void;
                value(): number;
                format: (x: any) => string;
                numInputs: number;
            };
            'Sum as Fraction of Total': (...x: any[]) => (data: any, rowKey: any, colKey: any) => {
                selector: any[] | never[][] | undefined;
                inner: any;
                push(record: any): void;
                format: (x: any) => string;
                value(): number;
                numInputs: any;
            };
            'Sum as Fraction of Rows': (...x: any[]) => (data: any, rowKey: any, colKey: any) => {
                selector: any[] | never[][] | undefined;
                inner: any;
                push(record: any): void;
                format: (x: any) => string;
                value(): number;
                numInputs: any;
            };
            'Sum as Fraction of Columns': (...x: any[]) => (data: any, rowKey: any, colKey: any) => {
                selector: any[] | never[][] | undefined;
                inner: any;
                push(record: any): void;
                format: (x: any) => string;
                value(): number;
                numInputs: any;
            };
            'Count as Fraction of Total': (...x: any[]) => (data: any, rowKey: any, colKey: any) => {
                selector: any[] | never[][] | undefined;
                inner: any;
                push(record: any): void;
                format: (x: any) => string;
                value(): number;
                numInputs: any;
            };
            'Count as Fraction of Rows': (...x: any[]) => (data: any, rowKey: any, colKey: any) => {
                selector: any[] | never[][] | undefined;
                inner: any;
                push(record: any): void;
                format: (x: any) => string;
                value(): number;
                numInputs: any;
            };
            'Count as Fraction of Columns': (...x: any[]) => (data: any, rowKey: any, colKey: any) => {
                selector: any[] | never[][] | undefined;
                inner: any;
                push(record: any): void;
                format: (x: any) => string;
                value(): number;
                numInputs: any;
            };
        };
        cols: never[];
        rows: never[];
        vals: never[];
        aggregatorName: string;
        sorters: {};
        rowOrder: string;
        colOrder: string;
    };
    processRecord(record: any): void;
    aggregator: any;
    formattedAggregators: any;
    tree: {};
    rowKeys: any[];
    colKeys: any[];
    rowTotals: {};
    colTotals: {};
    allTotal: any;
    subtotals: {};
    sorted: boolean;
    getFormattedAggregator(record: any, totalsKeys: any): any;
    arrSort(attrs: any, partialOnTop: any, reverse?: boolean): (a: any, b: any) => any;
    sortKeys(): void;
    getColKeys(): any[];
    getRowKeys(): any[];
    getAggregator(rowKey: any, colKey: any): any;
}
export namespace PivotData {
    function forEachRecord(input: any, processRecord: any): any[];
    namespace defaultProps {
        export { aggregators };
        export const cols: never[];
        export const rows: never[];
        export const vals: never[];
        export const aggregatorName: string;
        export const sorters: {};
        export const rowOrder: string;
        export const colOrder: string;
    }
    namespace propTypes {
        export const data: PropTypes.Validator<object>;
        const aggregatorName_1: PropTypes.Requireable<string>;
        export { aggregatorName_1 as aggregatorName };
        const cols_1: PropTypes.Requireable<(string | null)[]>;
        export { cols_1 as cols };
        const rows_1: PropTypes.Requireable<(string | null)[]>;
        export { rows_1 as rows };
        const vals_1: PropTypes.Requireable<(string | null)[]>;
        export { vals_1 as vals };
        export const valueFilter: PropTypes.Requireable<{
            [x: string]: {
                [x: string]: boolean | null;
            } | null;
        }>;
        const sorters_1: PropTypes.Requireable<((...args: any[]) => any) | {
            [x: string]: ((...args: any[]) => any) | null;
        }>;
        export { sorters_1 as sorters };
        export const derivedAttributes: PropTypes.Requireable<{
            [x: string]: ((...args: any[]) => any) | null;
        }>;
        const rowOrder_1: PropTypes.Requireable<string>;
        export { rowOrder_1 as rowOrder };
        const colOrder_1: PropTypes.Requireable<string>;
        export { colOrder_1 as colOrder };
    }
}
import PropTypes from "prop-types";
//# sourceMappingURL=utilities.d.ts.map