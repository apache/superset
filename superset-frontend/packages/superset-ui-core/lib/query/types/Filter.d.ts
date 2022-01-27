import { UnaryOperator, BinaryOperator, SetOperator } from './Operator';
import { TimeGranularity } from '../../time-format';
interface BaseSimpleAdhocFilter {
    expressionType: 'SIMPLE';
    clause: 'WHERE' | 'HAVING';
    subject: string;
    timeGrain?: TimeGranularity;
    isExtra?: boolean;
}
export declare type UnaryAdhocFilter = BaseSimpleAdhocFilter & {
    operator: UnaryOperator;
};
export declare type BinaryAdhocFilter = BaseSimpleAdhocFilter & {
    operator: BinaryOperator;
    comparator: string;
};
export declare type SetAdhocFilter = BaseSimpleAdhocFilter & {
    operator: SetOperator;
    comparator: string[];
};
export declare type SimpleAdhocFilter = UnaryAdhocFilter | BinaryAdhocFilter | SetAdhocFilter;
export interface FreeFormAdhocFilter {
    expressionType: 'SQL';
    clause: 'WHERE' | 'HAVING';
    sqlExpression: string;
}
export declare type AdhocFilter = SimpleAdhocFilter | FreeFormAdhocFilter;
export declare function isSimpleAdhocFilter(filter: AdhocFilter): filter is SimpleAdhocFilter;
export declare function isUnaryAdhocFilter(filter: SimpleAdhocFilter): filter is UnaryAdhocFilter;
export declare function isBinaryAdhocFilter(filter: SimpleAdhocFilter): filter is BinaryAdhocFilter;
export declare function isSetAdhocFilter(filter: SimpleAdhocFilter): filter is SetAdhocFilter;
export {};
//# sourceMappingURL=Filter.d.ts.map