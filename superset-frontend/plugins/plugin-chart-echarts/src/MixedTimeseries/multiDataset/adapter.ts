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
import { t } from '@apache-superset/core/translation';
import {
  ChartDataResponseResult,
  getXAxisLabel,
  QueryFormData,
} from '@superset-ui/core';
import { MultiDatasetResponseError } from './types';

/**
 * Merges the two single-query chart-data responses of a multi-dataset Mixed
 * Timeseries chart into the `[resultA, resultB]` structure that
 * `MixedTimeseries/transformProps` already consumes.
 */
export class MixedTimeseriesResponseAdapter {
  private readonly formData: QueryFormData;

  constructor(formData: QueryFormData) {
    this.formData = formData;
  }

  /**
   * Checks that each request returned exactly one result and that it
   * carries data and no error.
   *
   * @throws MultiDatasetResponseError describing the first problem found
   */
  validateResponses(
    responseA: ChartDataResponseResult[],
    responseB: ChartDataResponseResult[],
  ): void {
    [
      ['A', responseA],
      ['B', responseB],
    ].forEach(([name, response]) => {
      const results = response as ChartDataResponseResult[];
      if (!Array.isArray(results) || results.length !== 1) {
        throw new MultiDatasetResponseError(
          t(
            'Query %s returned an unexpected number of results.',
            name as string,
          ),
        );
      }
      const [result] = results;
      if (result.error) {
        throw new MultiDatasetResponseError(
          t('Query %s failed: %s', name as string, result.error),
        );
      }
      if (!Array.isArray(result.data) || !Array.isArray(result.colnames)) {
        throw new MultiDatasetResponseError(
          t('Query %s returned no data.', name as string),
        );
      }
    });
  }

  /**
   * Returns `[resultA, resultB]`, with Dataset B's X-axis renamed to Dataset
   * A's label. The chart reads both series under A's X-axis label, so B's
   * rows must carry that key even when `x_axis_b` is named differently.
   *
   * @throws MultiDatasetResponseError when a response is invalid, or the
   *   rename would overwrite another column of Dataset B
   */
  combineResponses(
    responseA: ChartDataResponseResult[],
    responseB: ChartDataResponseResult[],
  ): ChartDataResponseResult[] {
    this.validateResponses(responseA, responseB);
    const [resultA] = responseA;
    const [resultB] = responseB;
    return [resultA, this.rekeyXAxis(resultB)];
  }

  private rekeyXAxis(result: ChartDataResponseResult): ChartDataResponseResult {
    const data = this.formData as Record<string, unknown>;
    const labelA = getXAxisLabel(this.formData);
    const labelB = getXAxisLabel({
      ...this.formData,
      x_axis: data.x_axis_b,
    } as QueryFormData);

    if (!labelA || !labelB || labelA === labelB) {
      return result;
    }
    if (result.colnames.includes(labelA)) {
      throw new MultiDatasetResponseError(
        t(
          'Dataset B already has a column named "%s", which is the X-axis label of Query A. Rename the column or pick a different X-axis.',
          labelA,
        ),
      );
    }

    return {
      ...result,
      colnames: result.colnames.map(name => (name === labelB ? labelA : name)),
      data: result.data.map(row => {
        if (!(labelB in row)) return row;
        const { [labelB]: xValue, ...rest } = row;
        return { ...rest, [labelA]: xValue };
      }),
    };
  }
}
