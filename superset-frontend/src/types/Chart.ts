/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

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
  description: string | null;
  cache_timeout: number | null;
  certified_by?: string;
  certification_details?: string;
  form_data?: QueryFormData;
  query_context?: object;
  is_managed_externally: boolean;
  owners?: number[];
  datasource?: string;
  datasource_id?: number;
};

export default Chart;
