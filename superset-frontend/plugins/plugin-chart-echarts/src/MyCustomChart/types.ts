import { QueryFormData } from '@superset-ui/core';
import {
  BaseChartProps,
  BaseTransformedProps,
  ContextMenuTransformedProps,
  CrossFilterTransformedProps,
} from '../types';

export type MyCustomChartFormData = QueryFormData & {
  datasource: string;
  viz_type: string;
  metric?: string; // Metrix to Display
  groupby: string[]; // Categories to group by
  showlabels: boolean; // option to show labels
};

// Define properties for your chart component
export interface MyCustomChartProps
  extends BaseChartProps<MyCustomChartFormData>,
    CrossFilterTransformedProps {
  formData: MyCustomChartFormData;
  echartOptions: any;
  selectedValues: string[];
  refs: any;
}

export interface MyCustomChartTransformedProps
  extends BaseTransformedProps<MyCustomChartFormData>,
    ContextMenuTransformedProps {
  data: Array<{ label: string; value: number }>;
}

// Default data
export const DEFAULT_FORM_DATA: MyCustomChartFormData = {
  datasource: '',
  viz_type: 'my_custom_chart',
  groupby: [],
  metric: undefined,
  showlabels: true,
};
