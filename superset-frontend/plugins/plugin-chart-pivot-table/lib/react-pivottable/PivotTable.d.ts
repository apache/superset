export default PivotTable;
declare class PivotTable extends React.PureComponent<any, any, any> {
    constructor(props: Readonly<any>);
    constructor(props: any, context?: any);
}
declare namespace PivotTable {
    const propTypes: {
        data: import("prop-types").Validator<object>;
        aggregatorName: import("prop-types").Requireable<string>;
        cols: import("prop-types").Requireable<(string | null)[]>;
        rows: import("prop-types").Requireable<(string | null)[]>;
        vals: import("prop-types").Requireable<(string | null)[]>;
        valueFilter: import("prop-types").Requireable<{
            [x: string]: {
                [x: string]: boolean | null;
            } | null;
        }>;
        sorters: import("prop-types").Requireable<((...args: any[]) => any) | {
            [x: string]: ((...args: any[]) => any) | null;
        }>;
        derivedAttributes: import("prop-types").Requireable<{
            [x: string]: ((...args: any[]) => any) | null;
        }>;
        rowOrder: import("prop-types").Requireable<string>;
        colOrder: import("prop-types").Requireable<string>;
    };
    const defaultProps: {
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
}
import React from "react";
//# sourceMappingURL=PivotTable.d.ts.map