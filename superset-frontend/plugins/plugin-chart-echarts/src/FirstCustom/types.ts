// types.ts

import { QueryFormMetric } from '@superset-ui/core';

// Define the shape of the CustomChartProps
export interface CustomChartProps {
  formData: {
    metrics: Array<QueryFormMetric>;
    groupBy: string[];
    colorScheme: string;
    showDataLabels: boolean;
    isStacked: boolean;
    chartType: string;
    xAxisLabel?: string;
    yAxisLabel?: string;
  };
  queriesData: Array<{
    data: Array<Record<string, any>>;
  }>;
  width: number;
  height: number;
}

// Define the shape of the transformed chart properties
export interface CustomChartTransformProps {
  formData: CustomChartProps['formData'];
  width: number;
  height: number;
  echartOptions: {
    tooltip: {
      trigger: string;
      formatter: (params: any) => string;
    };
    series: Array<{
      type: string;
      data: Array<{
        name: string;
        value: any; // You may want to specify the actual type based on your data structure
        itemStyle: {
          color: string;
        };
        label: {
          show: boolean;
        };
      }>;
      stacking?: string;
      emphasis: {
        itemStyle: {
          shadowBlur: number;
          shadowColor: string;
        };
      };
      label: {
        show: boolean;
      };
    }>;
    xAxis: {
      type: string;
      name: string;
    };
    yAxis: {
      type: string;
      name: string;
    };
  };
}
