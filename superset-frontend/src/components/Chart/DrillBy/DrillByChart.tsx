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
import { useMemo } from 'react';
import {
  BaseFormData,
  QueryData,
  SuperChart,
  css,
  ContextMenuFilters,
} from '@superset-ui/core';
import { Dataset } from '../types';

interface DrillByChartProps {
  formData: BaseFormData & { [key: string]: any };
  result: QueryData[];
  dataset: Dataset;
  onContextMenu: (
    offsetX: number,
    offsetY: number,
    filters: ContextMenuFilters,
  ) => void;
  inContextMenu: boolean;
}

export default function DrillByChart({
  formData,
  result,
  dataset,
  onContextMenu,
  inContextMenu,
}: DrillByChartProps) {
  const hooks = useMemo(() => ({ onContextMenu }), [onContextMenu]);

  return (
    <div
      css={css`
        width: 100%;
        height: 100%;
        min-height: 0;
      `}
      data-test="drill-by-chart"
    >
      <SuperChart
        disableErrorBoundary
        chartType={formData.viz_type}
        enableNoResults
        datasource={dataset}
        formData={formData}
        queriesData={result}
        hooks={hooks}
        inContextMenu={inContextMenu}
        height="100%"
        width="100%"
      />
    </div>
  );
}
