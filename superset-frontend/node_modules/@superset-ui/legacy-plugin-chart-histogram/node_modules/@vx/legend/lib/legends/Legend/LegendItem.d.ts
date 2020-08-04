import React from 'react';
import { FlexDirection } from '../../types';
export declare type LegendItemProps = {
    flexDirection?: FlexDirection;
    alignItems?: string;
    margin?: string | number;
    children?: React.ReactNode;
    display?: string;
};
export default function LegendItem({ flexDirection, alignItems, margin, display, children, ...restProps }: LegendItemProps & Omit<React.HTMLProps<HTMLDivElement>, keyof LegendItemProps>): JSX.Element;
//# sourceMappingURL=LegendItem.d.ts.map