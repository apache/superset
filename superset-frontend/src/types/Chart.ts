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

import Owner from './Owner';

export interface Chart {
  id: number;
  url: string;
  viz_type: string;
  slice_name: string;
  creator: string;
  changed_on: string;
  changed_on_delta_humanized?: string;
  changed_on_utc?: string;
  description: string | null;
  cache_timeout: number | null;
  thumbnail_url?: string;
  owners?: Owner[];
  datasource_name_text?: string;
}

export type Slice = {
  id?: number;
  slice_id: number;
  slice_name: string;
  description: string | null;
  cache_timeout: number | null;
  url?: string;
};

export default Chart;
