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
import React, { useCallback, useMemo, useState } from 'react';
import { uniq } from 'lodash';
import { t, styled } from '@superset-ui/core';
import { Form } from 'src/common/components';
import { StyledModal } from 'src/common/components/Modal';
import ErrorBoundary from 'src/components/ErrorBoundary';
import { useFilterConfigMap, useFilterConfiguration } from '../state';
import { FilterRemoval, NativeFiltersForm } from './types';
import { FilterConfiguration } from '../types';
import {
  createHandleSave,
  createHandleTabEdit,
  generateFilterId,
  getFilterIds,
} from './utils';
import Footer from './Footer/Footer';
import FilterTabs from './FilterTabs';
import FiltersConfigForm from './FiltersConfigForm/FiltersConfigForm';
import { useOpenModal, useRemoveCurrentFilter } from './state';

export const StyledModalBody = styled.div`
  display: flex;
  flex-direction: row;
  .filters-list {
    width: ${({ theme }) => theme.gridUnit * 50}px;
    overflow: auto;
  }
`;

export const StyledForm = styled(Form)`
  width: 100%;
`;

export interface FiltersConfigModalProps {
  isOpen: boolean;
  initialFilterId?: string;
  createNewOnOpen?: boolean;
  onSave: (filterConfig: FilterConfiguration) => Promise<void>;
  onCancel: () => void;
}

/**
 * This is the modal to configure all the dashboard-native filters.
 * Manages modal-level state, such as what filters are in the list,
 * and which filter is currently being edited.
 *
 * Calls the `save` callback with the new FilterConfiguration object
 * when the user saves the filters.
 */
export function FiltersConfigModal({
  isOpen,
  initialFilterId,
  createNewOnOpen,
  onSave,
  onCancel,
}: FiltersConfigModalProps) {
  const [form] = Form.useForm<NativeFiltersForm>();

  // the filter config from redux state, this does not change until modal is closed.
  const filterConfig = useFilterConfiguration();
  const filterConfigMap = useFilterConfigMap();

  // new filter ids belong to filters have been added during
  // this configuration session, and only exist in the form state until we submit.
  const [newFilterIds, setNewFilterIds] = useState<string[]>([]);

  // store ids of filters that have been removed with the time they were removed
  // so that we can disappear them after a few secs.
  // filters are still kept in state until form is submitted.
  const [removedFilters, setRemovedFilters] = useState<
    Record<string, FilterRemoval>
  >({});

  const [saveAlertVisible, setSaveAlertVisible] = useState<boolean>(false);

  // The full ordered set of ((original + new) - completely removed) filter ids
  // Use this as the canonical list of what filters are being configured!
  // This includes filter ids that are pending removal, so check for that.
  const filterIds = useMemo(
    () =>
      uniq([...getFilterIds(filterConfig), ...newFilterIds]).filter(
        id => !removedFilters[id] || removedFilters[id]?.isPending,
      ),
    [filterConfig, newFilterIds, removedFilters],
  );

  // open the first filter in the list to start
  const initialCurrentFilterId = initialFilterId ?? filterIds[0];
  const [currentFilterId, setCurrentFilterId] = useState(
    initialCurrentFilterId,
  );

  // the form values are managed by the antd form, but we copy them to here
  // so that we can display them (e.g. filter titles in the tab headers)
  const [formValues, setFormValues] = useState<NativeFiltersForm>({
    filters: {},
  });

  const unsavedFiltersIds = newFilterIds.filter(id => !removedFilters[id]);
  // brings back a filter that was previously removed ("Undo")
  const restoreFilter = (id: string) => {
    const removal = removedFilters[id];
    // gotta clear the removal timeout to prevent the filter from getting deleted
    if (removal?.isPending) clearTimeout(removal.timerId);
    setRemovedFilters(current => ({ ...current, [id]: null }));
  };

  // generates a new filter id and appends it to the newFilterIds
  const addFilter = useCallback(() => {
    const newFilterId = generateFilterId();
    setNewFilterIds([...newFilterIds, newFilterId]);
    setCurrentFilterId(newFilterId);
    setSaveAlertVisible(false);
  }, [newFilterIds, setCurrentFilterId]);

  useOpenModal(isOpen, addFilter, createNewOnOpen);

  useRemoveCurrentFilter(
    removedFilters,
    currentFilterId,
    filterIds,
    setCurrentFilterId,
  );

  const handleTabEdit = createHandleTabEdit(
    setRemovedFilters,
    setSaveAlertVisible,
    addFilter,
  );

  // After this, it should be as if the modal was just opened fresh.
  // Called when the modal is closed.
  const resetForm = () => {
    form.resetFields();
    setNewFilterIds([]);
    setCurrentFilterId(initialCurrentFilterId);
    setRemovedFilters({});
    setSaveAlertVisible(false);
  };

  const getFilterTitle = (id: string) =>
    formValues.filters[id]?.name ??
    filterConfigMap[id]?.name ??
    t('New filter');

  const getParentFilters = (id: string) =>
    filterIds
      .filter(filterId => filterId !== id && !removedFilters[filterId])
      .map(id => ({
        id,
        title: getFilterTitle(id),
      }));

  const handleSave = createHandleSave(
    form,
    currentFilterId,
    filterConfigMap,
    filterIds,
    removedFilters,
    setCurrentFilterId,
    resetForm,
    onSave,
  );

  const handleConfirmCancel = () => {
    resetForm();
    onCancel();
  };

  const handleCancel = () => {
    if (unsavedFiltersIds.length > 0) {
      setSaveAlertVisible(true);
    } else {
      handleConfirmCancel();
    }
  };

  return (
    <StyledModal
      visible={isOpen}
      maskClosable={false}
      title={t('Filters configuration and scoping')}
      width="55%"
      destroyOnClose
      onCancel={handleCancel}
      onOk={handleSave}
      centered
      data-test="filter-modal"
      footer={
        <Footer
          onDismiss={() => setSaveAlertVisible(false)}
          onCancel={handleCancel}
          getFilterTitle={getFilterTitle}
          handleSave={handleSave}
          saveAlertVisible={saveAlertVisible}
          unsavedFiltersIds={unsavedFiltersIds}
          onConfirmCancel={handleConfirmCancel}
        />
      }
    >
      <ErrorBoundary>
        <StyledModalBody>
          <StyledForm
            preserve={false}
            form={form}
            onValuesChange={(changes, values: NativeFiltersForm) => {
              if (
                changes.filters &&
                Object.values(changes.filters).some(
                  (filter: any) => filter.name != null,
                )
              ) {
                // we only need to set this if a name changed
                setFormValues(values);
              }
              setSaveAlertVisible(false);
            }}
            layout="vertical"
          >
            <FilterTabs
              onEdit={handleTabEdit}
              onChange={setCurrentFilterId}
              getFilterTitle={getFilterTitle}
              currentFilterId={currentFilterId}
              filterIds={filterIds}
              removedFilters={removedFilters}
              restoreFilter={restoreFilter}
            >
              {(id: string) => (
                <FiltersConfigForm
                  form={form}
                  filterId={id}
                  filterToEdit={filterConfigMap[id]}
                  removed={!!removedFilters[id]}
                  restoreFilter={restoreFilter}
                  parentFilters={getParentFilters(id)}
                />
              )}
            </FilterTabs>
          </StyledForm>
        </StyledModalBody>
      </ErrorBoundary>
    </StyledModal>
  );
}
