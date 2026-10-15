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
import type { AdhocMetric } from '@superset-ui/core';

export const DURATION_TOTAL = '__duration_total_ms';
export const DURATION_RUNS = '__duration_runs';

// Average duration per run that recorded one (value > 0). Fetched as total +
// count so the component can combine rows correctly when it groups them.
export function durationMetrics(column: string): AdhocMetric[] {
  return [
    {
      expressionType: 'SQL',
      sqlExpression: `SUM(CASE WHEN ${column} > 0 THEN ${column} END)`,
      label: DURATION_TOTAL,
    },
    {
      expressionType: 'SQL',
      sqlExpression: `COUNT(CASE WHEN ${column} > 0 THEN 1 END)`,
      label: DURATION_RUNS,
    },
  ];
}
