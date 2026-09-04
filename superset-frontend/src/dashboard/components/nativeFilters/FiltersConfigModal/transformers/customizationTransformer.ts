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
import {
  ChartCustomization,
  ChartCustomizationDivider,
  ChartCustomizationType,
  NativeFilterTarget,
  Filter,
  Divider,
  NativeFilterType,
} from '@superset-ui/core';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import {
  ChartCustomizationsFormItem,
  NativeFiltersFormItem,
  NativeFilterDivider,
} from '../types';

type CustomizationFormInput =
  | ChartCustomizationsFormItem
  | ChartCustomizationDivider
  | ChartCustomization
  | NativeFiltersFormItem
  | NativeFilterDivider
  | Filter
  | Divider;

type ChartCustomizationFormOrSaved =
  | ChartCustomizationsFormItem
  | ChartCustomization;

function isFilterType(
  formInputs: CustomizationFormInput,
): formInputs is
  | NativeFiltersFormItem
  | NativeFilterDivider
  | Filter
  | Divider {
  return (
    'type' in formInputs &&
    (formInputs.type === NativeFilterType.NativeFilter ||
      formInputs.type === NativeFilterType.Divider)
  );
}

function isDividerType(
  formInputs: CustomizationFormInput,
): formInputs is ChartCustomizationDivider {
  return formInputs.type === ChartCustomizationType.Divider;
}

function isFormInput(
  formInputs: ChartCustomizationFormOrSaved,
): formInputs is ChartCustomizationsFormItem {
  return 'dataset' in formInputs && typeof formInputs.dataset === 'object';
}

function transformCustomizationDivider(
  id: string,
  formInputs: ChartCustomizationDivider,
): ChartCustomizationDivider {
  return {
    id,
    type: ChartCustomizationType.Divider,
    title: formInputs.title,
    description: formInputs.description,
  };
}

function buildCustomizationTarget(
  formInputs: ChartCustomizationsFormItem,
): Partial<NativeFilterTarget> {
  const target: Partial<NativeFilterTarget> = {};

  if (formInputs.dataset) {
    target.datasetId = formInputs.dataset.value;
  }

  if (formInputs.dataset && formInputs.column) {
    target.column = { name: formInputs.column };
  }

  return target;
}

function transformFormInput(
  id: string,
  formInputs: ChartCustomizationsFormItem,
): ChartCustomization {
  const defaultScope = {
    rootPath: [DASHBOARD_ROOT_ID],
    excluded: [],
  };

  return {
    id,
    type: ChartCustomizationType.ChartCustomization,
    name: formInputs.name,
    filterType: formInputs.filterType,
    description: (formInputs.description || '').trim(),
    targets: [buildCustomizationTarget(formInputs)],
    scope: formInputs.scope || defaultScope,
    controlValues: formInputs.controlValues ?? {},
    defaultDataMask: formInputs.defaultDataMask ?? {},
    removed: false,
  };
}

function transformSavedCustomization(
  id: string,
  customization: ChartCustomization,
): ChartCustomization {
  return {
    ...customization,
    id,
    description: (customization.description || '').trim(),
  };
}

function transformCustomization(
  id: string,
  formInputs: ChartCustomizationFormOrSaved,
): ChartCustomization {
  if (isFormInput(formInputs)) {
    return transformFormInput(id, formInputs);
  }
  return transformSavedCustomization(id, formInputs);
}

export function transformCustomizationForSave(
  id: string,
  formInputs: CustomizationFormInput | undefined,
): ChartCustomization | ChartCustomizationDivider | undefined {
  if (!formInputs) {
    return undefined;
  }

  if (isFilterType(formInputs)) {
    return undefined;
  }

  if (isDividerType(formInputs)) {
    return transformCustomizationDivider(id, formInputs);
  }

  return transformCustomization(id, formInputs);
}
