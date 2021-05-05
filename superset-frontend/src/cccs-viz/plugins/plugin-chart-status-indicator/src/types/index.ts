import { AdhocFilter, QueryFormData, QueryFormMetric } from '@superset-ui/core';

export type ChartProps = {
    markdowns: string [];
    backgroundColors: string[];
    textColor: string;
    orientation: string;
    roundedCorners: boolean;
    height: number;
    width: number;
};

export type FormData = QueryFormData & {
  adhoc_filters: AdhocFilter[];
  data_color_mapper: string;
  groupby: string[];
  markdown: string;
  metrics: QueryFormMetric[];
  number_format: string;
  order_desc: boolean;
  orientation: string;
  rounded_corners: boolean;
  text_color: string;
};

export type SupersetAppState = {
  common: {
    conf: {
      [key: string]: any,
    }
  }
};
