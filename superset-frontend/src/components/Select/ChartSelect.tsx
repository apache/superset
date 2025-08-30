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
import { t } from '@superset-ui/core';
import SelectAsyncControl from 'src/explore/components/controls/SelectAsyncControl';
import rison from 'rison';

export interface ChartSelectProps {
  value?: number | null;
  onChange: (value: number | null) => void;
  datasetId?: number;
  placeholder?: string;
  clearable?: boolean;
  ariaLabel?: string;
  label?: React.ReactNode;
}

/**
 * A chart selection component built on SelectAsyncControl
 * @param value - The selected chart ID
 * @param onChange - Callback when selection changes
 * @param datasetId - Optional dataset ID to filter charts
 * @param placeholder - Optional placeholder text
 * @param clearable - Whether the selection can be cleared
 * @param ariaLabel - ARIA label for accessibility
 * @param label - Form label (passed by Field component)
 */
export default function ChartSelectUsingAsync({
  value,
  onChange,
  datasetId,
  placeholder = t('Select a chart'),
  clearable = true,
  ariaLabel = t('Select drill-to-details chart'),
  label,
}: ChartSelectProps) {
  // Build query parameters for filtering charts by dataset
  const queryParams = useMemo(() => {
    if (!datasetId) return undefined;

    const filters = [
      {
        col: 'datasource_id',
        opr: 'eq',
        value: datasetId,
      },
      {
        col: 'datasource_type',
        opr: 'eq',
        value: 'table',
      },
    ];

    return {
      q: rison.encode({
        filters,
        order_column: 'slice_name',
        order_direction: 'asc',
      }),
    };
  }, [datasetId]);

  // Transform response to format expected by SelectAsyncControl
  const mutator = useMemo(
    () => (response: any) =>
      response.result.map((chart: any) => ({
        value: chart.id,
        label: `${chart.slice_name} (${chart.viz_type})`,
      })),
    [],
  );

  return (
    <SelectAsyncControl
      ariaLabel={ariaLabel}
      dataEndpoint="/api/v1/chart/"
      queryParams={queryParams}
      mutator={mutator}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      allowClear={clearable}
      multi={false}
      label={label}
    />
  );
}
