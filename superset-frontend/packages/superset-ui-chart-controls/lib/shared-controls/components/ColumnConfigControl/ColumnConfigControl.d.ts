/// <reference types="react" />
import { ChartDataResponseResult } from '@superset-ui/core';
import { ControlComponentProps } from '../types';
import { ColumnConfig, ColumnConfigFormLayout } from './types';
export declare type ColumnConfigControlProps<T extends ColumnConfig> = ControlComponentProps<Record<string, T>> & {
    queryResponse?: ChartDataResponseResult;
    configFormLayout?: ColumnConfigFormLayout;
    appliedColumnNames?: string[];
    emitFilter: boolean;
};
/**
 * Add per-column config to queried results.
 */
export default function ColumnConfigControl<T extends ColumnConfig>({ queryResponse, appliedColumnNames, value, onChange, configFormLayout, emitFilter, ...props }: ColumnConfigControlProps<T>): JSX.Element | null;
//# sourceMappingURL=ColumnConfigControl.d.ts.map