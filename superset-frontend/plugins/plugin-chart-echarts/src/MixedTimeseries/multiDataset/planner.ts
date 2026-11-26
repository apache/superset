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
import { QueryFormData } from '@superset-ui/core';
import { MIXED_TARGET_FIELD, MixedTarget } from '../buildQuery';
import { MultiDatasetValidationError } from './types';

type LooseFormData = Record<string, unknown>;

function hasValue(value: unknown): boolean {
  if (typeof value === 'string') return value.length > 0;
  return value !== undefined && value !== null && value !== false;
}

/**
 * Returns whether the form data describes a Mixed Timeseries chart whose
 * Query B runs against its own dataset.
 */
export function isMultiDatasetMode(formData: QueryFormData): boolean {
  const data = formData as LooseFormData;
  return Boolean(data.use_secondary_dataset) && hasValue(data.datasource_b);
}

/**
 * Splits a multi-dataset Mixed Timeseries chart into one request per dataset.
 *
 * The planner does not build query contexts itself. It returns the form data
 * stamped with the target, and `buildQuery` (invoked later by
 * `buildV1ChartDataPayload`) emits the single-query context for that target.
 */
export class MixedTimeseriesRequestPlanner {
  private readonly formData: QueryFormData;

  constructor(formData: QueryFormData) {
    this.formData = formData;
  }

  /**
   * Checks that both datasets and both X-axes are configured. Every problem
   * is collected so the user sees all of them at once.
   *
   * @throws MultiDatasetValidationError when the configuration is incomplete
   */
  validate(): void {
    const data = this.formData as LooseFormData;
    const errors: string[] = [];

    if (!hasValue(data.datasource)) {
      errors.push(t('Select Dataset A'));
    }
    if (!hasValue(data.datasource_b)) {
      errors.push(t('Select Dataset B'));
    }
    if (!hasValue(data.x_axis)) {
      errors.push(t('Select an X-axis for Query A'));
    }
    if (!hasValue(data.x_axis_b)) {
      errors.push(t('Select an X-axis for Query B'));
    }
    if (errors.length > 0) {
      throw new MultiDatasetValidationError(errors);
    }
  }

  /** Form data for the request that runs Query A against Dataset A. */
  buildRequestA(): QueryFormData {
    return this.stamp('A');
  }

  /** Form data for the request that runs Query B against Dataset B. */
  buildRequestB(): QueryFormData {
    return this.stamp('B');
  }

  private stamp(target: MixedTarget): QueryFormData {
    return { ...this.formData, [MIXED_TARGET_FIELD]: target } as QueryFormData;
  }
}
