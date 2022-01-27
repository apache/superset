/// <reference types="react" />
import { TimeseriesDataRecord } from '@superset-ui/core';
export interface EventFlowProps {
    data: TimeseriesDataRecord[];
    height: number;
    width: number;
    initialMinEventCount: number;
}
export default function EventFlow({ data, initialMinEventCount, height, width, }: EventFlowProps): JSX.Element;
//# sourceMappingURL=EventFlow.d.ts.map