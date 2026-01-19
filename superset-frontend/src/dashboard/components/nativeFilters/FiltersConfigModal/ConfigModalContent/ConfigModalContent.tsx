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
import { memo, RefObject } from 'react';
import {
  Filter,
  Divider,
  ChartCustomization,
  ChartCustomizationDivider,
} from '@superset-ui/core';
import type { FormInstance } from '@superset-ui/core/components';
import { styled } from '@apache-superset/core/ui';
import { Flex } from '@superset-ui/core/components';
import FilterContentRenderer from './FilterContentRenderer';
import CustomizationContentRenderer from './CustomizationContentRenderer';
import { FiltersConfigFormHandle } from '../FiltersConfigForm/FiltersConfigForm';
import { NativeFiltersForm, FilterRemoval } from '../types';
import { isFilterId, isChartCustomizationId } from '../utils';

const StyledContentFlex = styled(Flex)`
  flex: 1;
  overflow: hidden;
`;

export interface ConfigModalContentProps {
  currentItemId: string;
  filterIds: string[];
  chartCustomizationIds: string[];
  filterState: {
    orderedIds: string[];
    renderedIds: string[];
    removedItems: Record<string, FilterRemoval>;
  };
  customizationState: {
    orderedIds: string[];
    renderedIds: string[];
    removedItems: Record<string, FilterRemoval>;
  };
  filterConfigMap: Record<string, Filter | Divider>;
  chartCustomizationConfigMap: Record<
    string,
    ChartCustomization | ChartCustomizationDivider
  >;
  isItemActive: (id: string) => boolean;
  expanded: boolean;
  form: FormInstance<NativeFiltersForm>;
  configFormRef: RefObject<FiltersConfigFormHandle>;
  restoreItem: (id: string) => void;
  getAvailableFilters: (filterId: string) => {
    label: string;
    value: string;
    type: string | undefined;
  }[];
  activeFilterPanelKey: string | string[];
  handleActiveFilterPanelChange: (key: string | string[]) => void;
  handleSetErroredFilters: (updater: (filters: string[]) => string[]) => void;
  handleSetErroredCustomizations: (
    updater: (filters: string[]) => string[],
  ) => void;
  validateDependencies: () => void;
  getDependencySuggestion: (filterId: string) => string;
  handleModifyItem: (id: string) => void;
}

function ConfigModalContent({
  currentItemId,
  filterIds,
  chartCustomizationIds,
  filterState,
  customizationState,
  filterConfigMap,
  chartCustomizationConfigMap,
  isItemActive,
  expanded,
  form,
  configFormRef,
  restoreItem,
  getAvailableFilters,
  activeFilterPanelKey,
  handleActiveFilterPanelChange,
  handleSetErroredFilters,
  handleSetErroredCustomizations,
  validateDependencies,
  getDependencySuggestion,
  handleModifyItem,
}: ConfigModalContentProps) {
  const isFilterActive =
    isFilterId(currentItemId) && filterIds.includes(currentItemId);
  const isCustomizationActive =
    isChartCustomizationId(currentItemId) &&
    chartCustomizationIds.includes(currentItemId);

  return (
    <StyledContentFlex vertical>
      <div
        style={{
          display: isFilterActive ? 'flex' : 'none',
          flexDirection: 'column',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        <FilterContentRenderer
          orderedIds={filterState.orderedIds}
          renderedIds={filterState.renderedIds}
          removedItems={filterState.removedItems}
          filterConfigMap={filterConfigMap}
          isItemActive={isItemActive}
          expanded={expanded}
          form={form}
          configFormRef={configFormRef}
          restoreItem={restoreItem}
          getAvailableFilters={getAvailableFilters}
          activeFilterPanelKey={activeFilterPanelKey}
          handleActiveFilterPanelChange={handleActiveFilterPanelChange}
          handleSetErroredFilters={handleSetErroredFilters}
          validateDependencies={validateDependencies}
          getDependencySuggestion={getDependencySuggestion}
          handleModifyItem={handleModifyItem}
        />
      </div>
      <div
        style={{
          display: isCustomizationActive ? 'flex' : 'none',
          flexDirection: 'column',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        <CustomizationContentRenderer
          chartCustomizationIds={chartCustomizationIds}
          renderedIds={customizationState.renderedIds}
          removedItems={customizationState.removedItems}
          chartCustomizationConfigMap={chartCustomizationConfigMap}
          isItemActive={isItemActive}
          expanded={expanded}
          form={form}
          restoreItem={restoreItem}
          activeFilterPanelKey={activeFilterPanelKey}
          handleActiveFilterPanelChange={handleActiveFilterPanelChange}
          handleSetErroredCustomizations={handleSetErroredCustomizations}
          handleModifyItem={handleModifyItem}
        />
      </div>
    </StyledContentFlex>
  );
}

export default memo(ConfigModalContent);
