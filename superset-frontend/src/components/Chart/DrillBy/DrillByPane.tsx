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
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  ReactElement,
} from 'react';
import { ContextMenuFilters } from '@superset-ui/core';
import ChartContainer from 'src/components/Chart/ChartContainer';

export default function DrillByPane({
  chartId,
  dashboardId,
  filters,
  formData,
}: // initialFilters,
{
  dashboardId: number;
  chartId: number;
  filters: ContextMenuFilters['drillBy'];
  formData: { [key: string]: any; viz_type: string };;
  // initialFilters: BinaryQueryObjectFilterClause[];
}) {
  console.log("formData: ", formData) 
  return (
    <ChartContainer
      // datasource={formData.datasource}
      chartId={chartId}
      dashboardId={dashboardId}
      vizType={formData.viz_type}
      formData={formData}
    />
  );
}
