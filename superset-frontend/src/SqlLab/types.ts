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
import { SupersetError } from 'src/components/ErrorMessage/types';
import { CtasEnum } from 'src/SqlLab/actions/sqlLab';

export type Column = {
  name: string;
};

export type Query = {
  cached: boolean;
  ctas: boolean;
  ctas_method?: keyof typeof CtasEnum;
  dbId: number;
  errors?: SupersetError[];
  errorMessage: string | null;
  extra: {
    progress: string | null;
  };
  id: string;
  isDataPreview: boolean;
  link?: string;
  progress: number;
  results: {
    columns: Column[];
    data: Record<string, unknown>[];
    expanded_columns: Column[];
    selected_columns: Column[];
  };
  resultsKey: string | null;
  schema: string;
  sql: string;
  sqlEditorId: string;
  state:
    | 'stopped'
    | 'failed'
    | 'pending'
    | 'running'
    | 'scheduled'
    | 'success'
    | 'timed_out';
  tab: string | null;
  tempSchema: string | null;
  tempTable: string;
  trackingUrl: string | null;
  templateParams: any;
};
