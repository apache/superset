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
import { AdhocMetric, GenericDataType } from '@superset-ui/core';

export const NUM_METRIC: AdhocMetric = {
  expressionType: 'SIMPLE',
  label: 'Sum(num)',
  column: {
    id: 336,
    type: 'BIGINT',
    type_generic: GenericDataType.NUMERIC,
    column_name: 'num',
    verbose_name: null,
    description: null,
    expression: '',
    filterable: false,
    groupby: false,
    is_dttm: false,
    database_expression: null,
    python_date_format: null,
  },
  aggregate: 'SUM',
};
