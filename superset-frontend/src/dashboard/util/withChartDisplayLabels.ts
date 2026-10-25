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
import type { Datasource } from 'src/dashboard/types';

/** Add authorized labels for one chart without changing shared dataset metadata. */
export function withChartDisplayLabels<
  T extends Partial<Pick<Datasource, 'chart_display_labels' | 'verbose_map'>>,
>(datasource: T, chartId: number | string): T {
  const chartKey = String(chartId);
  const labelsByChart = datasource.chart_display_labels;
  if (
    chartKey === '__proto__' ||
    chartKey === 'constructor' ||
    !labelsByChart ||
    !Object.prototype.hasOwnProperty.call(labelsByChart, chartKey)
  ) {
    return datasource;
  }

  const labels = labelsByChart[chartKey];
  if (!labels || typeof labels !== 'object' || Array.isArray(labels)) {
    return datasource;
  }

  const additionalLabels = Object.entries(labels).filter(
    ([rawFieldId, label]) =>
      typeof label === 'string' &&
      label.trim().length > 0 &&
      !Object.prototype.hasOwnProperty.call(
        datasource.verbose_map ?? {},
        rawFieldId,
      ),
  );
  if (additionalLabels.length === 0) {
    return datasource;
  }

  return {
    ...datasource,
    verbose_map: {
      ...Object.fromEntries(additionalLabels),
      ...datasource.verbose_map,
    },
  };
}
