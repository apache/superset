// DODO was here

/**
 * The Chart model as returned from the API
 */

import { QueryFormData } from '@superset-ui/core';
import Owner from './Owner';
import Tag from './TagType';

export type ChartLinkedDashboard = {
  id: number;
  dashboard_title: string;
};

export interface Chart {
  id: number;
  url: string;
  viz_type: string;
  slice_name: string;
  slice_name_RU?: string;
  creator: string;
  changed_on: string;
  changed_on_delta_humanized?: string;
  changed_on_utc?: string;
  certified_by?: string;
  certification_details?: string;
  description: string | null;
  cache_timeout: number | null;
  thumbnail_url?: string;
  owners?: Owner[];
  tags?: Tag[];
  last_saved_at?: string;
  last_saved_by?: {
    id: number;
    first_name: string;
    last_name: string;
  };
  datasource_name_text?: string;
  form_data: {
    viz_type: string;
  };
  is_managed_externally: boolean;

  // TODO: Update API spec to describe `dashboards` key
  dashboards: ChartLinkedDashboard[];
}

export type Slice = {
  id?: number;
  slice_id: number;
  slice_name: string;
  slice_name_RU?: string;
  description: string | null;
  cache_timeout: number | null;
  certified_by?: string;
  certification_details?: string;
  form_data?: QueryFormData;
  query_context?: object;
  is_managed_externally: boolean;
  owners?: number[];
};

export default Chart;
