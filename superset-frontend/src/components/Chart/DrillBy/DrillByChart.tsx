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
import React, { useEffect, useState } from 'react';
import {
  Behavior,
  BinaryQueryObjectFilterClause,
  Column,
  css,
  SuperChart,
} from '@superset-ui/core';
import { simpleFilterToAdhoc } from 'src/utils/simpleFilterToAdhoc';
import { getChartDataRequest } from 'src/components/Chart/chartAction';
import Loading from 'src/components/Loading';

interface DrillByChartProps {
  column?: Column;
  filters?: BinaryQueryObjectFilterClause[];
  formData: { [key: string]: any; viz_type: string };
  groupbyFieldName?: string;
}

export default function DrillByChart({
  column,
  filters,
  formData,
  groupbyFieldName = 'groupby',
}: DrillByChartProps) {
  let updatedFormData = formData;
  let groupbyField: any = [];
  const [chartDataResult, setChartDataResult] = useState();

  if (column) {
    groupbyField = Array.isArray(formData[groupbyFieldName])
      ? [column.column_name]
      : column.column_name;
  }

  if (filters) {
    const adhocFilters = filters.map(filter => simpleFilterToAdhoc(filter));
    updatedFormData = {
      ...formData,
      adhoc_filters: [...formData.adhoc_filters, ...adhocFilters],
      [groupbyFieldName]: groupbyField,
    };
  }

  useEffect(() => {
    getChartDataRequest({
      formData: updatedFormData,
    }).then(({ json }) => {
      setChartDataResult(json.result);
    });
  }, []);

  return (
    <div
      css={css`
        width: 100%;
        height: 100%;
      `}
    >
      {chartDataResult ? (
        <SuperChart
          disableErrorBoundary
          behaviors={[Behavior.INTERACTIVE_CHART]}
          chartType={formData.viz_type}
          enableNoResults
          formData={updatedFormData}
          queriesData={chartDataResult}
          height="100%"
          width="100%"
        />
      ) : (
        <Loading />
      )}
    </div>
  );
}
