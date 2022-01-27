import { ChartProps } from '@superset-ui/core';
export default function transformProps(chartProps: ChartProps): {
    data: {
        [x: string]: unknown;
    }[];
    width: number;
    height: number;
    encoding: {
        x: {
            field: string | number;
            type: string;
            format: any;
            scale: {
                type: string;
            };
            axis: {
                orient: string;
                title: any;
            };
        };
        y: {
            field: string | number;
            type: string;
            format: any;
            scale: {
                type: string;
            };
            axis: {
                orient: string;
                title: any;
            };
        };
        size: {
            field: string | number;
            type: string;
            scale: {
                type: string;
                range: any[];
            };
        };
        fill: {
            field: string | number;
            type: string;
            scale: {
                scheme: any;
            };
            legend: any;
        };
        group: {
            field: string | number;
        }[];
    };
};
//# sourceMappingURL=transformProps.d.ts.map