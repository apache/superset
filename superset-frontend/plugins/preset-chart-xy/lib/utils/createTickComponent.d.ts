import { CSSProperties } from 'react';
import { AxisLayout } from './computeAxisLayout';
export default function createTickComponent({ axisWidth, labelAngle, labelFlush, labelOverlap, orient, tickLabels, tickLabelDimensions, tickTextAnchor, }: AxisLayout): (({ x, y, formattedValue, ...textStyle }: {
    x: number;
    y: number;
    dy?: number | undefined;
    formattedValue: string;
    textStyle: CSSProperties;
}) => JSX.Element) | null;
//# sourceMappingURL=createTickComponent.d.ts.map