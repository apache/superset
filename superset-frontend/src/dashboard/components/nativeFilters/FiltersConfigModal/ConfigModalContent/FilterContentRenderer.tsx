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
import { memo, useMemo, RefObject } from 'react';
import { Filter, Divider } from '@superset-ui/core';
import type { FormInstance } from '@superset-ui/core/components';
import FiltersConfigForm, {
  FiltersConfigFormHandle,
} from '../FiltersConfigForm/FiltersConfigForm';
import DividerConfigForm from '../DividerConfigForm';
import { NativeFiltersForm, FilterRemoval } from '../types';
import { NATIVE_FILTER_DIVIDER_PREFIX } from '../utils';

export interface FilterContentRendererProps {
  orderedIds: string[];
  renderedIds: string[];
  removedItems: Record<string, FilterRemoval>;
  filterConfigMap: Record<string, Filter | Divider>;
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
  validateDependencies: () => void;
  getDependencySuggestion: (filterId: string) => string;
  handleModifyItem: (id: string) => void;
}

function FilterContentRenderer({
  orderedIds,
  renderedIds,
  removedItems,
  filterConfigMap,
  isItemActive,
  expanded,
  form,
  configFormRef,
  restoreItem,
  getAvailableFilters,
  activeFilterPanelKey,
  handleActiveFilterPanelChange,
  handleSetErroredFilters,
  validateDependencies,
  getDependencySuggestion,
  handleModifyItem,
}: FilterContentRendererProps) {
  const formList = useMemo(
    () =>
      orderedIds.map(id => {
        if (!renderedIds.includes(id)) return null;
        const isDivider = id.startsWith(NATIVE_FILTER_DIVIDER_PREFIX);
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
                divider={filterConfigMap[id] as Divider}
              />
            ) : (
              <FiltersConfigForm
                expanded={expanded}
                ref={configFormRef}
                form={form}
                filterId={id}
                filterToEdit={filterConfigMap[id] as Filter}
                removedFilters={removedItems}
                restoreFilter={restoreItem}
                getAvailableFilters={getAvailableFilters}
                key={id}
                activeFilterPanelKeys={activeFilterPanelKey}
                handleActiveFilterPanelChange={handleActiveFilterPanelChange}
                isActive={isActive}
                setErroredFilters={handleSetErroredFilters}
                validateDependencies={validateDependencies}
                getDependencySuggestion={getDependencySuggestion}
                onModifyFilter={handleModifyItem}
              />
            )}
          </div>
        );
      }),
    [
      orderedIds,
      renderedIds,
      removedItems,
      handleSetErroredFilters,
      isItemActive,
      filterConfigMap,
      expanded,
      form,
      restoreItem,
      getAvailableFilters,
      activeFilterPanelKey,
      handleActiveFilterPanelChange,
      handleModifyItem,
      validateDependencies,
      getDependencySuggestion,
      configFormRef,
    ],
  );

  return <>{formList}</>;
}

export default memo(FilterContentRenderer);
