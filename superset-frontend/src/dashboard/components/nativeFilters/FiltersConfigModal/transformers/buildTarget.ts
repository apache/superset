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
import { DatasourceType, NativeFilterTarget } from '@superset-ui/core';

/**
 * Minimal shape of the form inputs that drive ``NativeFilterTarget``
 * construction. Native filters, chart customizations, and the modal save
 * path all populate these three fields the same way.
 */
export interface TargetFormInputs {
  dataset?: { value: number } | number;
  datasourceType?: DatasourceType;
  column?: string;
}

/**
 * Build the ``NativeFilterTarget`` carried by a native filter or chart
 * customization from its form inputs.
 *
 * Consolidates what used to live in three places — ``filterTransformer``,
 * ``customizationTransformer``, and ``createHandleSave`` — so changes to the
 * target shape only need to happen here.
 */
export function buildNativeFilterTarget(
  formInputs: TargetFormInputs,
): Partial<NativeFilterTarget> {
  const target: Partial<NativeFilterTarget> = {};

  if (formInputs.dataset != null) {
    target.datasetId =
      typeof formInputs.dataset === 'object'
        ? formInputs.dataset.value
        : formInputs.dataset;
  }

  if (formInputs.datasourceType) {
    target.datasourceType = formInputs.datasourceType;
  }

  if (formInputs.dataset != null && formInputs.column) {
    target.column = { name: formInputs.column };
  }

  return target;
}
