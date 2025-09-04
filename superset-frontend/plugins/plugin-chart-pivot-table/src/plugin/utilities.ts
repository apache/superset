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

import { MetricsLayoutEnum, PivotTableQueryFormData } from '../types';

export default function buildGroupbyCombinations(
  formData: PivotTableQueryFormData,
) {
  let columns = formData.groupbyColumns;
  let rows = formData.groupbyRows;

  [rows, columns] = formData.transposePivot ? [columns, rows] : [rows, columns];

  const rows_combinations = [[], ...rows.map((_, i) => rows.slice(0, i + 1))];
  const cols_combinations = [
    [],
    ...columns.map((_, i) => columns.slice(0, i + 1)),
  ];

  let groupbyCombinations = rows_combinations.flatMap(row =>
    cols_combinations.map(col => ({ rows: row, columns: col })),
  );

  if (formData.combineMetric) {
    if (formData.metricsLayout === MetricsLayoutEnum.ROWS) {
      groupbyCombinations = groupbyCombinations.filter(
        combination => combination.rows.length === rows.length,
      );
    } else {
      groupbyCombinations = groupbyCombinations.filter(
        combination => combination.columns.length === columns.length,
      );
    }
  }

  return groupbyCombinations;
}
