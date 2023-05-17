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
import { Column, Metric } from '@superset-ui/core';

export enum DrillByType {
  Chart,
  Table,
}

export type Dataset = {
  changed_by?: {
    first_name: string;
    last_name: string;
  };
  created_by?: {
    first_name: string;
    last_name: string;
  };
  changed_on_humanized: string;
  created_on_humanized: string;
  description: string;
  table_name: string;
  owners: {
    first_name: string;
    last_name: string;
  }[];
  columns?: Column[];
  metrics?: Metric[];
  verbose_map?: Record<string, string>;
};
