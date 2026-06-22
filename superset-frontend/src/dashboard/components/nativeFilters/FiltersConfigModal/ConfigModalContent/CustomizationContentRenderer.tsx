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
import { memo, useMemo } from 'react';
import {
  ChartCustomization,
  ChartCustomizationType,
  ChartCustomizationDivider,
} from '@superset-ui/core';
import type { FormInstance } from '@superset-ui/core/components';
import FiltersConfigForm from '../FiltersConfigForm/FiltersConfigForm';
import DividerConfigForm from '../DividerConfigForm';
import { NativeFiltersForm, FilterRemoval } from '../types';
import { CHART_CUSTOMIZATION_DIVIDER_PREFIX } from '../utils';

export interface CustomizationContentRendererProps {
  chartCustomizationIds: string[];
  renderedIds: string[];
  removedItems: Record<string, FilterRemoval>;
  chartCustomizationConfigMap: Record<
    string,
    ChartCustomization | ChartCustomizationDivider
  >;
  isItemActive: (id: string) => boolean;
  expanded: boolean;
  form: FormInstance<NativeFiltersForm>;
  restoreItem: (id: string) => void;
  activeFilterPanelKey: string | string[];
  handleActiveFilterPanelChange: (key: string | string[]) => void;
  handleSetErroredCustomizations: (
    updater: (filters: string[]) => string[],
  ) => void;
  handleModifyItem: (id: string) => void;
}

function CustomizationContentRenderer({
  chartCustomizationIds,
  renderedIds,
  removedItems,
  chartCustomizationConfigMap,
  isItemActive,
  expanded,
  form,
  restoreItem,
  activeFilterPanelKey,
  handleActiveFilterPanelChange,
  handleSetErroredCustomizations,
  handleModifyItem,
}: CustomizationContentRendererProps) {
  const customizationFormList = useMemo(
    () =>
      chartCustomizationIds.map(id => {
        if (!renderedIds.includes(id)) return null;
        const isDivider = id.startsWith(CHART_CUSTOMIZATION_DIVIDER_PREFIX);
        const isActive = isItemActive(id);
        return (
          <div
            key={id}
            style={{
              height: '100%',
              overflowY: 'auto',
              display: isActive ? '' : 'none',
            }}
          >
            {isDivider ? (
              <DividerConfigForm
                componentId={id}
                divider={
                  chartCustomizationConfigMap[id] as ChartCustomizationDivider
                }
              />
            ) : (
              <FiltersConfigForm
                filterId={id}
                itemType="chartCustomization"
                form={form}
                removedFilters={removedItems}
                restoreFilter={restoreItem}
                customizationToEdit={
                  chartCustomizationConfigMap[id]?.type ===
                  ChartCustomizationType.ChartCustomization
                    ? (chartCustomizationConfigMap[id] as ChartCustomization)
                    : undefined
                }
                expanded={expanded}
                getAvailableFilters={() => []}
                handleActiveFilterPanelChange={handleActiveFilterPanelChange}
                activeFilterPanelKeys={activeFilterPanelKey}
                isActive={isActive}
                setErroredFilters={handleSetErroredCustomizations}
                validateDependencies={() => {}}
                getDependencySuggestion={() => ''}
                onModifyFilter={handleModifyItem}
              />
            )}
          </div>
        );
      }),
    [
      chartCustomizationIds,
      renderedIds,
      removedItems,
      handleSetErroredCustomizations,
      isItemActive,
      form,
      restoreItem,
      chartCustomizationConfigMap,
      expanded,
      handleModifyItem,
      handleActiveFilterPanelChange,
      activeFilterPanelKey,
    ],
  );

  return <>{customizationFormList}</>;
}

export default memo(CustomizationContentRenderer);
