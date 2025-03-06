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

import { ClientErrorObject, SupersetError } from '@superset-ui/core';
import { FC } from 'react';
import { useChartOwnerNames } from 'src/hooks/apiResources';
import ErrorMessageWithStackTrace from 'src/components/ErrorMessage/ErrorMessageWithStackTrace';
import { ChartSource } from 'src/types/ChartSource';

export type Props = {
  chartId: string;
  error?: SupersetError;
  subtitle: React.ReactNode;
  link?: string;
  source: ChartSource;
  stackTrace?: string;
} & Omit<ClientErrorObject, 'error'>;

export const ChartErrorMessage: FC<Props> = ({ chartId, error, ...props }) => {
  // fetches the chart owners and adds them to the extra data of the error message
  const { result: owners } = useChartOwnerNames(chartId);

  // don't mutate props
  const ownedError = error && {
    ...error,
    extra: { ...error.extra, owners },
  };

  return <ErrorMessageWithStackTrace {...props} error={ownedError} />;
};
