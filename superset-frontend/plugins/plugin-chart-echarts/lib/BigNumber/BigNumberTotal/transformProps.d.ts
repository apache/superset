import { BigNumberTotalChartProps } from '../types';
export default function transformProps(chartProps: BigNumberTotalChartProps): {
    width: number;
    height: number;
    bigNumber: number | null;
    headerFormatter: import("packages/superset-ui-core/src/number-format/NumberFormatter").default | import("packages/superset-ui-core/src/time-format/TimeFormatter").default;
    headerFontSize: any;
    subheaderFontSize: any;
    subheader: any;
};
//# sourceMappingURL=transformProps.d.ts.map