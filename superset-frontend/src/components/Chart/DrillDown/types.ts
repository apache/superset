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
import { BinaryQueryObjectFilterClause } from '@superset-ui/core';

/**
 * One step of the user's drill-down journey: the column we drilled on
 * and the value the user clicked.
 */
export interface DrillDownLevel {
  /** Filter clauses identifying the clicked data point */
  filters: BinaryQueryObjectFilterClause[];
  /** Human-readable label for the breadcrumb (e.g. 'USA') */
  label: string;
}
