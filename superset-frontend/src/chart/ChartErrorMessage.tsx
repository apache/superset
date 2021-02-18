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

import React from 'react';
import rison from 'rison';
import {
  useApiV1Resource,
  useResourceTransform,
} from 'src/common/hooks/apiResources';
import ErrorMessageWithStackTrace from 'src/components/ErrorMessage/ErrorMessageWithStackTrace';
import { SupersetError } from 'src/components/ErrorMessage/types';
import Chart from 'src/types/Chart';

interface Props {
  chartId: string;
  error?: SupersetError;
}

function extractOwnerNames({ owners }: Chart) {
  if (!owners) return null;
  return owners.map(owner => `${owner.first_name} ${owner.last_name}`);
}

const namesQuery = rison.encode({
  columns: ['owners.first_name', 'owners.last_name', 'owners.id'],
  keys: ['none'],
});

function useChartOwnerNames(chartId: string) {
  const { result } = useResourceTransform(
    useApiV1Resource<Chart>(`/api/v1/chart/${chartId}?q=${namesQuery}`),
    extractOwnerNames,
  );
  return result;
}

/**
 * fetches the chart owners and adds them to the extra data of the error message
 */
export const ChartErrorMessage: React.FC<Props> = ({
  chartId,
  error,
  ...props
}) => {
  const owners = useChartOwnerNames(chartId);
  // don't mutate props
  const ownedError = error && {
    ...error,
    extra: { ...error.extra, owners },
  };

  return <ErrorMessageWithStackTrace {...props} error={ownedError} />;
};
