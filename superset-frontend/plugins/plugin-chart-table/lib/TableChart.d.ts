/// <reference types="react" />
import { DataRecord } from '@superset-ui/core';
import { TableChartTransformedProps } from './types';
import { DataTableProps } from './DataTable';
export default function TableChart<D extends DataRecord = DataRecord>(props: TableChartTransformedProps<D> & {
    sticky?: DataTableProps<D>['sticky'];
}): JSX.Element;
//# sourceMappingURL=TableChart.d.ts.map