/* eslint-disable import/prefer-default-export */
import { DatasourceType } from '@superset-ui/core';
import { Datasource } from 'src/dashboard/types';
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
export const PLACEHOLDER_DATASOURCE: Datasource = {
  id: 0,
  type: DatasourceType.Table,
  uid: '_placeholder_',
  datasource_name: '',
  table_name: '',
  columns: [],
  column_types: [],
  metrics: [],
  column_format: {},
  verbose_map: {},
  main_dttm_col: '',
  description: '',
};

export const MAIN_HEADER_HEIGHT = 53;
export const TABS_HEIGHT = 50;
export const HEADER_HEIGHT = 72;
export const CLOSED_FILTER_BAR_WIDTH = 32;
export const OPEN_FILTER_BAR_WIDTH = 260;
export const FILTER_BAR_HEADER_HEIGHT = 80;
export const FILTER_BAR_TABS_HEIGHT = 46;
export const BUILDER_SIDEPANEL_WIDTH = 374;
