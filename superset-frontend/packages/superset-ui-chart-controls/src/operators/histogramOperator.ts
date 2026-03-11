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
 * specific language governing permissions and limitationsxw
 * under the License.
 */
import { PostProcessingHistogram, getColumnLabel } from '@superset-ui/core';
import { PostProcessingFactory } from './types';

/* eslint-disable @typescript-eslint/no-unused-vars */
export const histogramOperator: PostProcessingFactory<
  PostProcessingHistogram
> = (formData, queryObject) => {
  const { bins, column, cumulative, groupby = [], normalize } = formData;
  const parsedBins = Number.isNaN(Number(bins)) ? 5 : Number(bins);
  const parsedColumn = getColumnLabel(column);
  const parsedGroupBy = groupby!.map(getColumnLabel);
  return {
    operation: 'histogram',
    options: {
      column: parsedColumn,
      groupby: parsedGroupBy,
      bins: parsedBins,
      cumulative,
      normalize,
    },
  };
};
