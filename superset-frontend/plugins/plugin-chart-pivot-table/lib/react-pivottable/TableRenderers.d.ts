export class TableRenderer extends React.Component<any, any, any> {
    constructor(props: any);
    clickHeaderHandler(pivotData: any, values: any, attrs: any, attrIdx: any, callback: any, isSubtotal?: boolean, isGrandTotal?: boolean): (e: any) => any;
    clickHandler(pivotData: any, rowValues: any, colValues: any): (e: any) => any;
    getBasePivotSettings(): {
        pivotData: PivotData;
        colAttrs: any;
        rowAttrs: any;
        colKeys: any[];
        rowKeys: any[];
        rowTotals: any;
        colTotals: any;
        arrowCollapsed: any;
        arrowExpanded: any;
        colSubtotalDisplay: any;
        rowSubtotalDisplay: any;
        cellCallbacks: {};
        rowTotalCallbacks: {};
        colTotalCallbacks: {};
        grandTotalCallback: ((e: any) => any) | null;
        namesMapping: any;
    };
    collapseAttr(rowOrCol: any, attrIdx: any, allKeys: any): (e: any) => void;
    expandAttr(rowOrCol: any, attrIdx: any, allKeys: any): (e: any) => void;
    toggleRowKey(flatRowKey: any): (e: any) => void;
    toggleColKey(flatColKey: any): (e: any) => void;
    calcAttrSpans(attrArr: any, numAttrs: any): number[][];
    renderColHeaderRow(attrName: any, attrIdx: any, pivotSettings: any): JSX.Element;
    renderRowHeaderRow(pivotSettings: any): JSX.Element;
    renderTableRow(rowKey: any, rowIdx: any, pivotSettings: any): JSX.Element;
    renderTotalsRow(pivotSettings: any): JSX.Element;
    visibleKeys(keys: any, collapsed: any, numAttrs: any, subtotalDisplay: any): any;
    cachedProps: any;
    cachedBasePivotSettings: {
        pivotData: PivotData;
        colAttrs: any;
        rowAttrs: any;
        colKeys: any[];
        rowKeys: any[];
        rowTotals: any;
        colTotals: any;
        arrowCollapsed: any;
        arrowExpanded: any;
        colSubtotalDisplay: any;
        rowSubtotalDisplay: any;
        cellCallbacks: {};
        rowTotalCallbacks: {};
        colTotalCallbacks: {};
        grandTotalCallback: ((e: any) => any) | null;
        namesMapping: any;
    } | undefined;
}
export namespace TableRenderer {
    const propTypes: {
        tableOptions: PropTypes.Requireable<object>;
        data: PropTypes.Validator<object>;
        aggregatorName: PropTypes.Requireable<string>;
        cols: PropTypes.Requireable<(string | null)[]>;
        rows: PropTypes.Requireable<(string | null)[]>;
        vals: PropTypes.Requireable<(string | null)[]>;
        valueFilter: PropTypes.Requireable<{
            [x: string]: {
                [x: string]: boolean | null;
            } | null;
        }>;
        sorters: PropTypes.Requireable<((...args: any[]) => any) | {
            [x: string]: ((...args: any[]) => any) | null;
        }>;
        derivedAttributes: PropTypes.Requireable<{
            [x: string]: ((...args: any[]) => any) | null;
        }>;
        rowOrder: PropTypes.Requireable<string>;
        colOrder: PropTypes.Requireable<string>;
    };
    const defaultProps: {
        tableOptions: {};
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
import PropTypes from "prop-types";
//# sourceMappingURL=TableRenderers.d.ts.map